// Client-side authentication functions

var auth =
{
    request_token: function()
    {
        
    }
};

$(document).ready(function()
{
    $('body').append($('<iframe class="test" src="http://localhost:1339/?username=rachel&password=hello">'));
    
    $('.test').on('load', function()
    {
        console.log($(this).get(0).contentWindow.location.href);
    });
});
