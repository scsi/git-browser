#! /usr/bin/perl

# Originally from gitweb.cgi,
# (C) 2005, Kay Sievers <kay.sievers@vrfy.org>
# (C) 2005, Christian Gierke <ch@gierke.de>

# This program is licensed under the GPL v2, or a later version

use strict;
use warnings;
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

my $request=CGI::new();

package git::inner;

# location of the git-core binaries
$git::inner::gitbin="";
$git::inner::git_temp="/tmp/gitweb";

sub git_commitdiff {
	my ($id1, $id2)=@_;
	mkdir($git::inner::git_temp, 0700);
	open my $fd, "-|", "${git::inner::gitbin}/git-diff-tree -r $id1 $id2" or die_error(undef, "Open failed.");
	my (@difftree) = map { chomp; $_ } <$fd>;
	close $fd or die_error(undef, "Reading diff-tree failed.");

	git_header_html(undef, $inner::http_expires);

	print "<div class=\"page_body\">\n";
	foreach my $line (@difftree) {
		# ':100644 100644 03b218260e99b78c6df0ed378e59ed9205ccc96d 3b93d5e7cc7f7dd4ebed13a5cc1a4ad976fc94d8 M      ls-files.c'
		# ':100644 100644 7f9281985086971d3877aca27704f2aaf9c448ce bc190ebc71bbd923f2b728e505408f5e54bd073a M      rev-tree.c'
		$line =~ m/^:([0-7]{6}) ([0-7]{6}) ([0-9a-fA-F]{40}) ([0-9a-fA-F]{40}) (.)\t(.*)$/;
		my $from_mode = $1;
		my $to_mode = $2;
		my $from_id = $3;
		my $to_id = $4;
		my $status = $5;
		my $file = validate_input(unquote($6));
		if ($status eq "A") {
#			print "<div class=\"diff_info\">" .  file_type($to_mode) . ":" .
#			      $cgi->a({-href => "$my_uri?" . esc_param("p=$project;a=blob;h=$to_id;hb=$hash;f=$file")}, $to_id) . "(new)" .
#			      "</div>\n";
			git_diff_print(undef, "/dev/null", $to_id, "b/$file");
		} elsif ($status eq "D") {
#			print "<div class=\"diff_info\">" . file_type($from_mode) . ":" .
#			      $cgi->a({-href => "$my_uri?" . esc_param("p=$project;a=blob;h=$from_id;hb=$hash;f=$file")}, $from_id) . "(deleted)" .
#			      "</div>\n";
			git_diff_print($from_id, "a/$file", undef, "/dev/null");
		} elsif ($status eq "M") {
			if ($from_id ne $to_id) {
#				print "<div class=\"diff_info\">" .
#				      file_type($from_mode) . ":" . $cgi->a({-href => "$my_uri?" . esc_param("p=$project;a=blob;h=$from_id;hb=$hash;f=$file")}, $from_id) .
#				      " -> " .
#				      file_type($to_mode) . ":" . $cgi->a({-href => "$my_uri?" . esc_param("p=$project;a=blob;h=$to_id;hb=$hash;f=$file")}, $to_id);
#				print "</div>\n";
				git_diff_print($from_id, "a/$file",  $to_id, "b/$file");
			}
		}
	}
	print "</div>";
	git_footer_html();
}

sub git_diff_print {
	my $from = shift;
	my $from_name = shift;
	my $to = shift;
	my $to_name = shift;
	my $format = shift || "html";

	my $from_tmp = "/dev/null";
	my $to_tmp = "/dev/null";
	my $pid = $$;

	# create tmp from-file
	if (defined $from) {
		$from_tmp = "${git::inner::git_temp}/gitweb_" . $$ . "_from";
		open my $fd2, "> $from_tmp" or die "error creating $from_tmp: $! $@";
		open my $fd, "-|", "${git::inner::gitbin}/git-cat-file blob $from";
		my @file = <$fd>;
		print $fd2 @file;
		close $fd2;
		close $fd;
	}

	# create tmp to-file
	if (defined $to) {
		$to_tmp = "${git::inner::git_temp}/gitweb_" . $$ . "_to";
		open my $fd2, "> $to_tmp" or die "error creating $from_tmp: $! $@";
		open my $fd, "-|", "${git::inner::gitbin}/git-cat-file blob $to";
		my @file = <$fd>;
		print $fd2 @file;
		close $fd2;
		close $fd;
	}

	open my $fd, "-|", "/usr/bin/diff -u -p -L \'$from_name\' -L \'$to_name\' $from_tmp $to_tmp";
	if ($format eq "plain") {
		undef $/;
		print <$fd>;
		$/ = "\n";
	} else {
		while (my $line = <$fd>) {
			chomp($line);
			my $char = substr($line, 0, 1);
			my $color = "";
			if ($char eq '+') {
				$color = " style=\"color:#008800;\"";
			} elsif ($char eq "-") {
				$color = " style=\"color:#cc0000;\"";
			} elsif ($char eq "@") {
				$color = " style=\"color:#990099;\"";
			} elsif ($char eq "\\") {
				# skip errors
				next;
			}
			while ((my $pos = index($line, "\t")) != -1) {
				if (my $count = (8 - (($pos-1) % 8))) {
					my $spaces = ' ' x $count;
					$line =~ s/\t/$spaces/;
				}
			}
			print "<div class=\"pre\"$color>" . esc_html($line) . "</div>\n";
		}
	}
	close $fd;

	if (defined $from) {
		unlink($from_tmp);
	}
	if (defined $to) {
		unlink($to_tmp);
	}
}

sub validate_input {
	my $input = shift;

	if ($input =~ m/^[0-9a-fA-F]{40}$/) {
		return $input;
	}
	if ($input =~ m/(^|\/)(|\.|\.\.)($|\/)/) {
		return undef;
	}
	if ($input =~ m/[^a-zA-Z0-9_\x80-\xff\ \t\.\/\-\+\#\~\%]/) {
		return undef;
	}
	return $input;
}


# replace invalid utf8 character with SUBSTITUTION sequence
sub esc_html {
	my $str = shift;
	if( $^V ge v5.8.0 ) {
		$str = Encode::decode("utf8", $str, Encode::FB_DEFAULT);
	}
	$str = CGI::escapeHTML($str);
	return $str;
}

# git may return quoted and escaped filenames
sub unquote {
	my $str = shift;
	if ($str =~ m/^"(.*)"$/) {
		$str = $1;
		$str =~ s/\\([0-7]{1,3})/chr(oct($1))/eg;
	}
	return $str;
}

sub git_header_html {
	my $status = shift || "200 OK";
	my $expires = shift;

	print $request->header(-type=>'text/html',  -charset => 'utf-8', -status=> $status, -expires => $expires);
	print <<EOF;
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">
<head>
<meta http-equiv="content-type" content="text/html; charset=utf-8"/>
<title>git diff</title>
</head>
<body>
EOF
}

sub git_footer_html {
	print "</body>\n" .
	      "</html>";
}

sub die_error {
	my $status = shift || "403 Forbidden";
	my $error = shift || "Malformed query, file missing or permission denied";

	git_header_html($status);
	print "<div class=\"page_body\">\n" .
	      "<br/><br/>\n" .
	      "$status - $error\n" .
	      "<br/>\n" .
	      "</div>\n";
	git_footer_html();
	exit;
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
			}elsif( m/^repos:\s*/ ) {
				$section="repos";
			}
		}
	}
}


package main;

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

my $repo=$request->param( "repo" );
my $id1=$request->param( "id1" );
my $id2=$request->param( "id2" );

git::inner::die_error( "403 Forbidden", "malformed value for repo param" ) unless defined validate_input( $repo );
git::inner::die_error( "403 Forbidden", "malformed value for id1 param" ) unless defined validate_input( $id1 );
git::inner::die_error( "403 Forbidden", "malformed value for id2 param" ) unless defined validate_input( $id2 );

$ENV{'GIT_DIR'}=$inner::known_repos{$repo};

git::inner::git_commitdiff( $id1, $id2 );
