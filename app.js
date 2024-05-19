var fs = require('fs');
var datpix = require('./module.js');
var yuri = require('url');
var path = require('path');
var sqlite3 = require('sqlite3').verbose();
var express = require('express');
var app = express();
var session = require('express-session');
var crypto = require('crypto');

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

//./run.sh

const db = new sqlite3.Database('./config/plantcarebook.db');

app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } //CHANGE IF HTTPS ENABLED!!!
}));

const requireAuth = (req, res, next) => {
    if (req.session.userId) {
        next(); // Lietotājs ir autentificēts, turpiniet ar nākamo starpprogrammatūru
    } else {
        res.redirect('/login'); // Lietotājs nav autentificēts, novirzīt uz pieslēgšanās lapu
    }
}

const requireNoAuth = (req, res, next) => {
    if (req.session.userId) {
        res.redirect('/'); // Lietotājs ir autentificēts, novirzīt uz mājaslapu
    } else {
        next(); // Lietotājs nav autentificēts, turpināt ar nākamo starpprogrammatūru
    }
}

const requireAdmin = (req, res, next) => {
    const userId = req.session.userId;
    db.get('SELECT * FROM Users WHERE user_id = ? AND admin = 1', [userId], (err, row) => {
    if (err) {
        console.error('Error querying user:', err);
        res.status(500).send('Internal Server Error');
        return;
      }
      if (!row) {
          res.redirect('/'); //Lietotājs nav administrators, sūtīt uz mājaslapu
      } else {
          next(); // Lietotājs ir administrators, turpināt ar nākamo starpprogrammatūru
      }
    });
  };

app.get('/', requireAuth, function (req, res) {
    res.sendFile(path.join(__dirname, 'public', 'datatest.html'));
 });

app.get('/login', requireNoAuth, function (req, res) {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
 });

app.get('/register', requireNoAuth, function (req, res) {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
 });

app.post('/validate', (req, res) => { //Verificēt vai ievadītie dati sakrīt ar kādu no pastāvošiem lietotājiem un uzsāk sesiju
    const { username } = req.body;
    const password = sha256(req.body.password);
    console.log(username, password);
    //console.log(datpix.foo());
    db.get('SELECT * FROM Users WHERE username = ? AND password = ?', [username, password], (err, row) => {
        if (err)  {
            console.error('internal server error after login:', err);
            res.status(500).send('Internal Server Error'); //500 internal server error
            return;
        }
        if (!row) {
            console.log('Incorrect username or password');
            res.status(401).send('Nepareizs lietotājvārds vai parole'); //401 unauthorized
            return;
        }
        const userId = row.user_id;
        req.session.userId = userId;
        console.log('User is validated!'); // Lietotājs ir verificēts un sesija ir uzsākta
        res.redirect('/');
    });
});

app.get('/logout', (req, res) => { //beigt sesiju
  req.session.destroy((err) => {
    if (err) {
      console.error('logout unsuccessful:', err);
      res.status(500).send('Internal Server Error');
      return;
    }
    res.redirect('/login');
  });
});

app.post('/newuser', (req, res) => { //Jauna lietotāja izveidei
    const { username, password, repeatPassword } = req.body;
    db.get('SELECT 1 FROM Users WHERE username = ?', [username], (err, row) => { //vaicājums datubāzei ievadītam lietotājvārdam
      if (err) {
        console.error('internal server error querying username:', err);
        res.status(500).send('Internal Server Error'); //500 internal server error
        return;
      }
      if (row) { //pārbauda vai lietotājvārds pastāv
        res.status(400).send('Šāds lietotājvārds jau pastāv. Lūdzu, izvēlieties citu lietotājvārdu.');
        return;
      }
      if (isAlphaNumeric(username) == false) { //pārbauda vai lietotājvārdā ievietoti neatļauti simboli
        res.status(400).send('Lietotājvārds ietver neatļautus simbolus. Lūdzu, izmantojiet tikai burtciparu simbolus (a-z, A-Z, 0-9)');
        return;
      } //Username OK, move on
      if (password !== repeatPassword) { //pārbauda vai paroļu laukumi sakrīt
        res.status(400).send('Paroles nesakrīt');
        return;
      }
      if (isSecure(password) == false) { //pārbauda vai parole pietiekami droša
        res.status(400).send('Parole neatbilst nosacījumiem. Lūdzu, ievadiet vismaz 6 simbolus un ievietojat vismaz 1 burtu(a-z, A-Z), 1 ciparu(0-9) un 1 īpašo simbolu(#?!@$%^&-*).');
        return;
      }
      if (isAcceptable(password) == false) { //pārbauda vai parolē ievietoti neatļauti simboli
        res.status(400).send('Parole ietver neatļautus simbolus. Lūdzu, izmantojiet tikai burtciparu simbolus (a-z, A-Z, 0-9) un biežāk lietojamos īpašos simbolus(#?!@$%^&-*)');
        return;
      } //Password OK, move on
      const hashedPassword = sha256(password); //hešo paroli pirms ievietošanas datubāzē
      console.log(username, hashedPassword);
      db.run('INSERT INTO Users(username, password) VALUES(?, ?)', [username, hashedPassword], function(err) { //create new row(user) in db
          if (err)  {
              console.error('internal server error after creating user:', err);
              res.status(500).send('Internal Server Error'); //500 internal server error
              return;
          }
          console.log('User is created!'); // Log successful account creation attempt
          res.redirect('/login');
      });
    });
});

app.post('/newlog', requireAuth, (req, res) => {
    var timestamp = new Date();
    console.log(timestamp);
    const userId = req.session.userId;
    console.log(userId);
    const { plantId, logType, logInput } = req.body;
    console.log(plantId, logType, logInput);
      db.run('INSERT INTO Logs(plant_id, user_id, time, type, content) VALUES(?, ?, ?, ?, ?)', [plantId, userId, timestamp, logType, logInput], function(err) { //izveidot jaunu rindu dbāzē
          if (err)  {
              console.error('internal server error after creating log:', err);
              res.status(500).send('Internal Server Error'); //500 internal server error
              return;
          }
          console.log('Log is created!'); // Log successful log creation attempt
          res.redirect('/plants/' + plantId); //ielādet lapu atkal, jau ar jaunajiem datiem
      });
    });

app.post('/newplant', requireAuth, requireAdmin, (req, res) => {
    const { number, name, summerLocation, schooltimeLocation, frequency } = req.body;
    if (isBlank(number) || isBlank(name) || isBlank(summerLocation) || isBlank(schooltimeLocation) || isBlank(frequency)) { //vai nav tukšumu ar "  "
      res.status(400).send('Lūdzu aizpildiet visus laukumus, lai pievienotu augu.')
      return;
    }
    if (isPos(frequency) == false) { //vai biežuma lauciņā nav ievadīts negatīvs skaitlis vai 0
      res.status(400).send('Laistīšanas biežums var būt tikai pozitīvs skaitlis')
      return;
    }
    db.get('SELECT 1 FROM Plants WHERE number = ?', [number], (err, row) => {
      if (err) {
        console.error('internal server error querying number:', err);
        res.status(500).send('Internal Server Error'); //500 internal server error
        return;
      }
      if (row) { //pārbauda vai augs ar šādu numuru jau pastāv
        res.status(400).send('Augs ar šādu numuru jau pastāv, lūdzu izvēlieties citu.')
        return;
      }
      db.run('INSERT INTO Plants(number, name, summer_location, schooltime_location, frequency) VALUES(?, ?, ?, ?, ?)', [number, name, summerLocation, schooltimeLocation, frequency], function(err) { //create new row(log) in db
          if (err)  {
              console.error('internal server error after creating plant:', err);
              res.status(500).send('Internal Server Error'); //500 internal server error
              return;
          }
          console.log('Plant is created!'); // Log successful log creation attempt
          res.redirect('/'); //ielādet lapu atkal, jau ar jaunajiem datiem
      });
    });
  });

app.post('/editplant', requireAuth, requireAdmin, (req, res) => { //auga datu rediģēšanai
    const { plantId, oldNumber, number, name, summerLocation, schooltimeLocation, frequency } = req.body;
    if (isBlank(number) || isBlank(name) || isBlank(summerLocation) || isBlank(schooltimeLocation) || isBlank(frequency)) { //vai nav tukšumu ar "  "
      res.status(400).send('Lūdzu aizpildiet visus laukumus, lai veiksmīgi rediģētu augu.')
      return;
    }
    if (isPos(frequency) == false) { //vai biežuma lauciņā nav ievadīts negatīvs skaitlis vai 0
      res.status(400).send('Laistīšanas biežums var būt tikai pozitīvs skaitlis')
      return;
    }
    if (oldNumber != number) { //if number has been edited
      db.get('SELECT 1 FROM Plants WHERE number = ?', [number], (err, row) => {
        if (err) {
          console.error('internal server error querying number:', err);
          res.status(500).send('Internal Server Error'); //500 internal server error
          return;
        }
        if (row) { //pārbauda vai rinda ar šādu numuru jau pastāv
          res.status(400).send('Augs ar šādu numuru jau pastāv, lūdzu izvēlieties citu.')
          return;
        }
        db.run('UPDATE Plants SET number = ?,name = ?, summer_location = ?, schooltime_location = ?, frequency = ? WHERE plant_id = ?', [number, name, summerLocation, schooltimeLocation, frequency, plantId], function(err) { //rediģēt rindu dbāzē
            if (err)  {
                console.error('internal server error after creating plant:', err);
                res.status(500).send('Internal Server Error'); //500 internal server error
                return;
            }
            console.log('Plant has been edited!'); // Log successful log creation attempt
            res.redirect('/plants/' + plantId); //ielādet auga lapu atkal, jau ar jaunajiem datiem
      });
    });
      } else {
      db.run('UPDATE Plants SET number = ?,name = ?, summer_location = ?, schooltime_location = ?, frequency = ? WHERE plant_id = ?', [number, name, summerLocation, schooltimeLocation, frequency, plantId], function(err) { //rediģēt rindu dbāzē
          if (err)  {
              console.error('internal server error after creating plant:', err);
              res.status(500).send('Internal Server Error'); //500 internal server error
              return;
          }
          console.log('Plant has been edited!'); // Log successful log creation attempt
          res.redirect('/plants/' + plantId); //ielādet auga lapu atkal, jau ar jaunajiem datiem
      });
    }
  });

app.get('/user', requireAuth, function (req, res) { //lai ienestu lietotāja datus, kur nepieciešams, sesijas laikā
    const userId = req.session.userId;
    db.get('SELECT * FROM Users WHERE user_id = ?', [userId], (err, row) => {
        if (err) {
            console.error('internal server error querying ID:', err);
            res.status(500).send('Internal Server Error'); //500 internal server error
            return;
        }
        if (!row) {
            console.log('User not Found');
            res.status(404).send('404 Not Found'); //404 not found
            return;
        }
        console.log('user: success!');
        res.setHeader('Content-Type', 'application/json');
        res.json(row);
    });
});

app.get('/plants/:id', requireAuth, (req,res) => { //dinamiski renderēt auga informācijas EJS veidni, kad tas tiek pieprasīts
    const plantId = req.params.id;
    db.get('SELECT * FROM Plants WHERE plant_id = ?', [plantId], (err, row) => {
        if (err) {
            console.error('internal server error querying ID:', err);
            res.status(500).send('Internal Server Error'); //500 internal server error
            return;
        }
        if (!row) {
            console.log('Plant not Found');
            res.status(404).send('404 Not Found'); //404 not found
            return;
        }
        console.log('id: success!')
        db.all('SELECT * FROM Logs WHERE plant_id = ?', [plantId], (err, logs) => {
            if (err) {
                console.error(err.message);
                res.status(500).send('Internal Server Error');
                return;
            }
            logs.forEach(log => { //formatēt laiku uz lasāmu formātu no dbāzē glabātā UNIX formāta
              var properTime = parseFloat(log.time); //pārvērst uz pieņemamu formātu no string
              var date = new Date(properTime); //veido date objektu
              var year = date.getFullYear();
              var month = String(date.getMonth() + 1).padStart(2, '0'); // Mēnešī sākas no 0 tapēc +1
              var day = String(date.getDate()).padStart(2, '0');
              console.log(year, month, day);
              log.formattedTime = `${year}-${month}-${day}`; //šo var ievietot EJS ar log.formattedTime
            });
            console.log('logs: success!')
            res.render('plant.ejs', { logs: logs, plant: row });
        });
    });
});

app.get('/plants/:id/edit', requireAuth, requireAdmin, (req,res) => { //dinamiski renderēt auga rediģēšanas EJS veidni, kad tas tiek pieprasīts
    const plantId = req.params.id;
    db.get('SELECT * FROM Plants WHERE plant_id = ?', [plantId], (err, row) => {
        if (err) {
            console.error('internal server error querying ID:', err);
            res.status(500).send('Internal Server Error'); //500 internal server error
            return;
        }
        if (!row) {
            console.log('Plant not Found');
            res.status(404).send('404 Not Found'); //404 not found
            return;
        }
        console.log('id: success!')
        res.render('plantedit.ejs', { plant: row });
    });
});

app.get('/data', requireAuth, (req, res) => { //lai ienestu visu augu(Plants) tabulu
    db.all('SELECT * FROM Plants ORDER BY number ASC', (err, rows) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Internal Server Error');
        } else {
            // Sūtīt JSON atbildi ar fetched datiem
            res.setHeader('Content-Type', 'application/json');
            res.json(rows);
        }
    });
});

app.get('/laistiishana', (req, res) => {
  db.get('SELECT MAX(time) AS last_cits_date FROM Logs WHERE plant_id = ? AND type = ?', [1, 'Cits'], (err, row) => {
    if (err) {
      console.error('Error executing query:', err);
      return;
    }
    console.log('Last cits date:', row.last_cits_date);
  });
});

function isAlphaNumeric(input) { //ievades atbilstība zemāk dotam regex, burtciparu simboli
  const regex = /^[a-zA-Z0-9]+$/;
  return regex.test(input);
}

function isAcceptable(input) { //ievades atbilstība zemāk dotam regex
  const regex = /^[a-z0-9#?!@$%^&\-*]+$/i; //a-z0-9#?!@$%^&-*
  return regex.test(input);
}

function isBlank(str) { //ievades pārbaude vai tajā ir tikai tukši simboli
   return str.trim().length === 0;
}

function isPos(num) { //skaitļa pārbaude vai ir pozitīvs
  return num > 0;
}

function isSecure(input) { //pārbaude vai parole ir droša
  const regexAlpha = /[a-z]/i;
  const regexNum = /[0-9]/;
  const regexSp = /[#?!@$%^&\-*]/;
  if (input.length >= 6 && regexAlpha.test(input) && regexNum.test(input) && regexSp.test(input)) {
      return true;
  } else {
      return false;
  }
}

function sha256(hashable) { //jaucējparoles izveide
  return crypto.createHash('sha256').update(hashable).digest('hex');
}

 app.use((req, res) => {
    res.status(404).send('404 Not Found');
 });

 app.listen(8080, () => {
    console.log(`Server listening`);
});
