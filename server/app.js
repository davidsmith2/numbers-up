var express = require('express');
var http = require('http');
var path = require('path');

var app = express();

app.use(require('connect-livereload')({
    port: 35729
}));

app.use(express.static(path.join(__dirname, '../build')));
app.use('/', express.static(path.join(__dirname, '../build')));

app.set('views', __dirname + '/views');

// traditional routes

app.get('/', function (req, res) {
    res.render('index.jade', {
        title: 'Numbers Up',
        isPageLoad: true
    });
});

http.createServer(app).listen(3000, function () {
    console.log('Express App started!');
});

module.exports = app;
