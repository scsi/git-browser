#! /usr/bin/perl
use CGI;

my $request=CGI::new();
my $sleep_seconds=$request->param( "sleep" );

sleep $sleep_seconds if $sleep_seconds;

print "Content-type: text/html\r\n\r\n";
print <<EOF;
<html>
<head>
<script type="text/javascript">
<!--
document.result="ok";
// -->
</script>
</head>
<body></body>
</html>
EOF
