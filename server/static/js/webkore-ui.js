$(document).ready(function()
{
    $('body').on('keydown', function(event)
    {
        // When a user presses enter
        if(event.which == 13)
        {
            var $wrap = $('.chat-input-wrap');
            var $chat = $('.chat-message-input');
            
            if($chat.val())
            {
                $chat.val('');
            }
            else ragnarok.data.chat.status = !ragnarok.data.chat.status;
 
            if(ragnarok.data.chat.status)   $wrap.addClass('active');
            else                            $wrap.removeClass('active');
            
            ragnarok.ui.populate.chat();
        }        
    });
});
