# Harness shim. See lib/CGI.pm.
package CGI::Cookie;
use strict; use warnings;
sub new   { my $c = shift; return bless {@_}, ref($c)||$c||'CGI::Cookie'; }
sub fetch { return (); }
sub value { return undef; }
sub name  { return undef; }
sub import { }
1;
