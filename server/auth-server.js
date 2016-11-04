/* Webkore Authentication Server! */

var express = require('express'),
    app     = require('express')(),
    server  = require('http').createServer(app),
    crypto  = require('crypto'),
    config  = require('./config');

if(typeof config.secret == "undefined")
{
    console.log("Error: No shared secret defined in our config file!");

    // Exit the process with an error
    process.exit(1);
}

// Otherwise, let's wait for a connection!
server.listen(1339);
console.log("Authentication server running on port 1339");

app.get('/', function(req, res)
{
    // Get username, password, and callback url
    var username = req.query.username,
        password = req.query.password,
        callback = req.query.callback;

    if(username && password)
    {
        if(typeof callback == "undefined") callback = "http://localhost:1337/auth";

        // Get current timestamp
        var date = new Date().getTime();

        // Hash password
        password = crypto.createHash('whirlpool').update(password).digest('hex');

        // Hash it all together!
        var token = crypto.createHmac("sha256", config.secret).update(date + username + password).digest("hex");
        
        res.writeHead(302, {
          'Location': callback + '?date=' + date + '&username=' + encodeURIComponent(username) + '&token=' + token
        });

        console.log("Token generated.");
    }

    res.end();
});

