// Client-side authentication functions
// Maybe there'll be more to it eventually? xD

var auth =
{
    request_token: function(username, password)
    {
        $('body').append($('<iframe class="auth-frame" src="http://localhost:1339/?username='+username+'&password='+password+'">'));
    }
};

