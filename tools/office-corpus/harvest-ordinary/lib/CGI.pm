# Minimal CGI shim — enough for officium.pl run from the command line.
#
# HARNESS CODE ONLY. This supplies the handful of CGI entry points the Divinum
# Officium engine touches (new, param, header, cookie, charset, redirect) so the
# renderer runs offline without pulling CGI.pm's URI/CGI::Util dependency tree.
# It touches no liturgical text: every word harvested comes out of the engine's
# own render.
package CGI;
use strict;
use warnings;

our $VERSION = '0.01-shim';

# Command-line args arrive as "name=value" pairs, which is how
# regress/scripts/generate-diff.sh drives the renderer.
my %PARAMS;
my $INITED = 0;

sub _init_params {
    return if $INITED;
    $INITED = 1;
    for my $arg (@ARGV) {
        next unless $arg =~ /^([^=]+)=(.*)$/s;
        $PARAMS{$1} = $2;
    }
}

sub new {
    my ($class) = @_;
    _init_params();
    return bless {}, ref($class) || $class || 'CGI';
}

sub param {
    my $self = shift;
    _init_params();
    return keys %PARAMS unless @_;
    my $name = shift;
    if (@_) { $PARAMS{$name} = shift; }
    return $PARAMS{$name};
}

sub url_param   { my $s = shift; return $s->param(@_); }
sub multi_param { my $s = shift; my $v = $s->param(@_); return defined $v ? ($v) : (); }
sub Vars        { _init_params(); return {%PARAMS}; }

sub header   { return ''; }
sub charset  { return 'utf-8'; }
sub redirect { return ''; }
sub cookie   { return undef; }

sub escapeHTML {
    my ($self, $t) = @_;
    $t = $self unless ref $self;
    return '' unless defined $t;
    $t =~ s/&/&amp;/g; $t =~ s/</&lt;/g; $t =~ s/>/&gt;/g; $t =~ s/"/&quot;/g;
    return $t;
}

sub import { }

1;
