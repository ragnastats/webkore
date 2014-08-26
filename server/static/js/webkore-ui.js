$(document).ready(function()
{
    $('body').on('keydown', function(event)
    {
        var $wrap = $('.chat-input-wrap');
        var $chat = $('.chat-message-input');
        
        // When a user presses enter
        if(event.which == 13)
        {
            var value = $chat.val();

            if(value)
            {
                var command = value.split(' ');
                
                if(command[0] == "/login")
                {
                    auth.request_token(command[1], command[2]);
                }
                else
                {
                    ragnarok.data.chat.input.unshift(value)
                    socket.emit('input', {message: value});
                }
                
                $chat.val('');
            }
            else ragnarok.data.chat.status = !ragnarok.data.chat.status;
 
            if(ragnarok.data.chat.status)   $wrap.addClass('active');
            else                            $wrap.removeClass('active');
            
            $chat.trigger('focus');
            ragnarok.ui.populate.chat();
        }

        // Behaviors for an active chat
        if(ragnarok.data.chat.status)
        {
            var scrollback = ragnarok.data.chat.scrollback;
            if(typeof scrollback == "undefined") scrollback = -1;
            
            // Up arrow
            if(event.which == 38)
            {
                scrollback++;
                if(scrollback > ragnarok.data.chat.input.length) scrollback = ragnarok.data.chat.input.length;

                $chat.val(ragnarok.data.chat.input[scrollback]);

                setTimeout(function() { $chat.select() }, 0);
                ragnarok.data.chat.scrollback = scrollback;
            }
            
            // Down arrow
            else if(event.which == 40)
            {
                scrollback--;
                if(scrollback < -1) scrollback = -1;

                if(scrollback == -1)
                    $chat.val('');
                else
                    $chat.val(ragnarok.data.chat.input[scrollback]);

                setTimeout(function() { $chat.select() }, 0);
                ragnarok.data.chat.scrollback = scrollback;
            }
        }
    });
});
