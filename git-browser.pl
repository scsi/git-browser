#! /usr/bin/perl

# (C) 2005, Artem Khodush <greenkaa@gmail.com>

# This program contains parts from gitweb.cgi,
# (C) 2005, Kay Sievers <kay.sievers@vrfy.org>
# (C) 2005, Christian Gierke <ch@gierke.de>

# This program is licensed under the GPL v2, or a later version

package git::inner;

# location of the git-core binaries
$git::inner::gitbin="";
$git::inner::git_temp="tmp";

sub git_get_type
{
	my $hash = shift;
	open my $fd, "-|", "${git::inner::gitbin}git-cat-file", '-t', $hash or die "git_get_type: error running git-cat-file: $!";
	my $type = <$fd>;
	close $fd or die "git_get_type: unable to close fd: $!";
	chomp $type;
	$type =~ s/\r$//;
	return $type;
}

sub git_read_commits
{
	my $arg=shift;
	my $MAX_COUNT= $arg->{shortcomment} ? 400 : 200;
	my @command=("${git::inner::gitbin}git-rev-list", '--header', '--parents', "--max-count=$MAX_COUNT");
	push(@command, @{$arg->{id}}, @{$arg->{x}});
	push(@command, '--', @{$arg->{path}}) if @{$arg->{path}};

	my %commits;

	$/ = "\0";
	open my $fd, "-|", @command or die "git_read_commits: error running git-rev-list: $!";
	while( my $commit_line=<$fd> ) {
		$commit_line =~ s/\r$//;
		my @commit_lines = split '\n', $commit_line;
		pop @commit_lines;
		my %co;

		my $header = shift @commit_lines;
		if (!($header =~ m/^[0-9a-fA-F]{40}/)) {
			next;
		}
		($co{'id'}, my @parents) = split ' ', $header;
		$co{'parents'} = \@parents;
		while (my $line = shift @commit_lines) {
			last if $line eq "\n";
# minimize http traffic - do not read not used things
#			if ($line =~ m/^tree ([0-9a-fA-F]{40})$/) {
#				$co{'tree'} = $1;
#			} els
			if ($line =~ m/^author (.*) ([0-9]+) (.*)$/) {
				$co{'author'} = $1;
				$co{'author_epoch'} = $2;
#				$co{'author_tz'} = $3;
			}elsif ($line =~ m/^committer (.*) ([0-9]+) (.*)$/) {
#				$co{'committer'} = $1;
				$co{'committer_epoch'} = $2;
#				$co{'committer_tz'} = $3;
			}
		}
#		if (!defined $co{'tree'}) {
#			next;
#		};

		# remove added spaces
		foreach my $line (@commit_lines) {
			$line =~ s/^    //;
		}
		if( $arg->{shortcomment} ) {
			$co{'comment'} = [$commit_lines[0]];
		}else {
			$co{'comment'} = \@commit_lines;
		}

		$commits{$co{'id'}}=\%co;
	}
	close $fd or die "git_read_commit: unable to close fd: $!";
	$/ = "\n";

	return \%commits;
}


sub get_ref_ids
{
	my $repo=$ENV{'GIT_DIR'};
	my $exec="\"";
	$exec.="PATH=$ENV{PATH} " if $ENV{PATH};
	$exec.="GIT_EXEC_PATH=$ENV{GIT_EXEC_PATH} " if $ENV{GIT_EXEC_PATH};
	$exec.="${git::inner::gitbin}git-upload-pack\"";
	open my $fd, "-|", "${git::inner::gitbin}git-ls-remote --upload-pack=$exec $repo" or die "get_ref_ids: error running git-peek-remote: $!";
	my @refs;
	my %names;
	while( my $line=<$fd> ) {
		my ($id,$name)=split ' ', $line;
		if( $name=~s/^refs\/heads\/// ) {
			push @refs, { type=>"h", id=>$id, name=>$name };
		}elsif( $name=~s/^refs\/tags\/// ) {
			my $deref=0;
			if( $name=~m/\^\{\w*\}$/ ) { # it's dereferenced
				$deref=1;
				$name=$`;
			}
			# if several ids for a name is seen, we are interested only in the last dereferenced one
			$names{$name}={} unless exists $names{$name};
			$names{$name}->{$deref}=$id;
			push @refs, { type=>"t", id=>$id, name=>$name };
		}
	}
	close $fd or die "git_get_type: unable to close fd: $!";
	# keep only commits
	my @result;
	for my $ref (@refs) {
		if( $ref->{type} eq "h" ) {
			# assume all heads are commits
			push @result, $ref;
		}else {
			my $id_kind=$names{$ref->{name}};
			# so. if several ids for a name is seen, keep only in the last dereferenced one
			if( $ref->{id} eq $id_kind->{1} || ($ref->{id} eq $id_kind->{0} && !exists $id_kind->{1}) ) {
				# and only if it's a commit
				push @result, $ref if git_get_type( $ref->{id} ) eq "commit";
			}
		}
	}
	return \@result;
}

package git;

sub get_ref_names
{
	my $refs=git::inner::get_ref_ids;
	my $result={ tags=>[], heads=>[] };
	for my $ref (@$refs) {
		push @{$result->{tags}}, $ref->{name} if $ref->{type} eq "t";
		push @{$result->{heads}}, $ref->{name} if $ref->{type} eq "h";
	}
	return $result;
}

sub commits_from_refs
{
	my $arg=shift;
	# can't just do git_read_commits. mapping from ref names to ids must also be returned for labels to work.
	my $refs=git::inner::get_ref_ids;
	my @start_ids;
	for (@{$arg->{ref}}) {
		my ($type,$name)=split ",";
		if( "r" eq $type ) {
			push @start_ids, $_->{id} for (grep( "h" eq $_->{type}, @$refs )); # all heads
		}else {
			push @start_ids, $_->{id} for (grep( $name eq $_->{name} && $type eq $_->{type}, @$refs ));
		}
	}
	return { refs=>$refs, commits=>commits_from_ids( { id=>\@start_ids, x=>$arg->{x}, path=>$arg->{path}, shortcomment=>$arg->{shortcomment} } ) };
}

sub commits_from_ids
{
	my $arg=shift;
	return git::inner::git_read_commits( $arg );
}

package inner;

sub read_config
{
	open my $f, "< git-browser.conf" or return;
	my $section="";
	while( <$f> ) {
		chomp;
		$_=~ s/\r$//;
		if( $section eq "repos" ) {
			if( m/^\w+:\s*/ ) {
				$section="";
				redo;
			}else {
				my ($name,$path)=split;
				if( $name && $path ) {
					$inner::known_repos{$name}=$path;
				}
			}
		}else {
			if( m/^gitbin:\s*/ ) {
				$git::inner::gitbin=$';
				$ENV{GIT_EXEC_PATH}=$';
			}elsif( m/^path:\s*/ ) {
				$ENV{PATH}=$';
			}elsif( m/^http_expires:\s*/ ) {
				$inner::http_expires=$';
			}elsif( m/^git_temp:\s*/ ) {
				$git::inner::git_temp=$';
			}elsif( m/^warehouse:\s*/ ) {
				$inner::warehouse=$';
			}elsif( m/^repos:\s*/ ) {
				$section="repos";
			}
		}
	}
}


package main;

use JSON::Converter;
use CGI qw(:standard :escapeHTML -nosticky);
use CGI::Util qw(unescape);
use CGI::Carp qw(fatalsToBrowser);
BEGIN {
	if( $^V ge v5.8.0 ) {
		require Encode; import Encode;
		require Fcntl; import Fcntl ':mode';
	}else {
		no strict "refs";
		*{"Encode::FB_DEFAULT"}=sub { 1; };
		*{"Encode::decode"}=sub { my ($a,$s,$b)=@_; return $s; };
	}
}

if( $^V ge v5.8.0 ) {
	binmode STDOUT, ':utf8';
}

sub get_repo_path
{
	my ($name) = @_;
	my $path = $inner::known_repos{$name};
	if (not defined $path and $inner::warehouse and -d $inner::warehouse.'/'.$name) {
		$path = $inner::warehouse.'/'.$name;
	}
	return $path;
}

sub get_repo_names
{
	my @a=keys %inner::known_repos;
	return \@a;
}
sub validate_input {
	my $input = shift;

	if ($input =~ m/^[0-9a-fA-F]{40}$/) {
		return $input;
	}
	if ($input =~ m/(^|\/)(|\.|\.\.)($|\/)/) {
		return undef;
	}
	if ($input =~ m/[^a-zA-Z0-9_\x80-\xff\ \t\.\/\-\+\*\~\%\,]/) {
		return undef;
	}
	return $input;
}



inner::read_config();

my $converter=JSON::Converter->new;
my $request=CGI::new();

my $repo;
my $sub;
my $arg={};

my $result="null";
my $error="null";

my @names=$request->param;
for my $pn (@names) {
	if( $pn eq "repo" ) {
		$repo=$request->param( "repo" );
	}elsif( $pn eq "sub" ) {
		$sub=$request->param( "sub" );
	}else {
		my @v=$request->param( $pn );
		for my $v (@v) {
			$error=$converter->valueToJson( "invalid cgi param value for '$pn': '$v'\n" ) unless defined validate_input( $v );
		}
		$arg->{$pn}=\@v;
	}
}

if( $error eq "null" ) {
	if( !defined( $sub ) ) {
		$error=$converter->valueToJson( "git-browser.pl: 'sub' cgi parameter is omitted" );
	}elsif( exists $main::{$sub} ) {
		eval {
			$result=&{$main::{$sub}}( $arg );
		};
		if( $@ ) {
			$error=$converter->valueToJson( "error in main::$sub: $@" );
		}else {
			$result=$converter->objToJson( $result );
		}
	}elsif( exists $git::{$sub} ) {
		if( !defined( $repo ) ) {
			$error=$converter->valueToJson( "git-browser.pl: 'repo' cgi parameter is omitted" );
		}elsif( !get_repo_path($repo) ) {
			$error=$converter->valueToJson( "git-browser.pl: unknown repository name specified: $repo" );
		}else {
			$ENV{'GIT_DIR'}=get_repo_path($repo);
			eval {
				$result=&{$git::{$sub}}( $arg );
			};
			if( $@ ) {
				$error=$converter->valueToJson( "error in git::$sub: $@" );
			}else {
				$result=$converter->objToJson( $result );
			}
		}
	}else {
		$error=$converter->valueToJson( "git-browser.pl: no procedure '$sub' in either git or main package" );
	}
}

print $request->header(-type=>'text/html',  -charset => 'utf-8', -status=> "200 OK", -expires => $inner::http_expires);

print <<EOF;
<html>
<head>
<script type="text/javascript">
document.error=$error;
document.result=$result;
</script>
</head>
<body>
</body>
</html>
EOF

0;
