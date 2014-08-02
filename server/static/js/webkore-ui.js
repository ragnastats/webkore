$(document).ready(function()
{
    $('body').on('keydown', function(event)
    {
        // When a user presses enter
        if(event.which == 13)
        {
            var $wrap = $('.chat-input-wrap');
            var $chat = $('.chat-message-input');
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
    });
});
