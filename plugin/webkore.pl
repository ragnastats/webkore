package WebKore;
 
# Perl includes
use strict;
use Data::Dumper;
use Time::HiRes;
use List::Util;
use IO::Socket;
use Storable;

# Kore includes
use Settings;
use Plugins;
use Network;
use Globals;
 
our @queue;
our $remote ||= IO::Socket::INET->new(Proto => 'tcp', PeerAddr => '192.168.1.234', PeerPort => 1338, Reuse => 1);
 
Commands::register(["remote", "To a land far far away", \&remote]);
Plugins::register("WebKore", "OpenKore's Web Interface", \&unload);
my $hooks = Plugins::addHooks(['mainLoop_post', \&loop],
								['packet/public_chat', \&chatHandler],
								['packet/self_chat', \&chatHandler],
								['packet/emoticon', \&chatHandler],
								['packet/party_chat', \&chatHandler],
								['packet/guild_chat', \&chatHandler]);

sub unload
{
	Plugins::delHooks($hooks);
}
 
sub loop
{
	if($remote)
	{
		# Check connection status
		if($remote->connected())
		{
		
		}

		# Check for new messages
		while(@queue)
		{
			print $remote shift(@queue);
		}
	}
}

sub chatHandler
{
    my($packet, $args) = @_;
	push(@queue, $args->{message});
	print(Dumper($args));
}

sub remote
{
    my($command, $message) = @_;
	push(@queue, $message);
}

1;