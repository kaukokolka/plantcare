var fs = require('fs');
var dt = require('./module.js');
var yuri = require('url');
var path = require('path');
var sqlite3 = require('sqlite3').verbose();
var express = require('express');
var app = express();

app.use(express.urlencoded({ extended: true }));
//NEED DB DEFINED
//const db = new sqlite3.Database('./config/plantcarebook.db');

//const db = require('./config/db'); // Require the database connection

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
 });

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM Users WHERE username = ? AND password = ?', [username, password], (err, row) => {
        if (err || !row) {
            res.send('Incorrect username or password');
        } else {
            res.send('User is validated!');
        }
    });
});

 app.use((req, res) => {
    res.status(404).send('404 Not Found')
 }); 

 app.listen(8080, () => {
    console.log(`Server listening`);
});
