var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var crypto = require('crypto');
var User = require('./app/models/user');

var db = require('./app/config');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');


var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.use(session({secret: 'keyboard cat'}));//set up a secret for the session to use.


app.get('/',
function(req, res) {
  if(!checkUser(req)){
      res.redirect('/login');
    }
  res.render('index');
});

app.get('/login',function(req,res){

    res.render('login');
});
app.get('/signup',function(req,res){

    res.render('signup');
});

app.get('/logout',function(req,res){
  req.session.destroy(function(){
    res.redirect('/login');
  });
});

app.get('/create',
function(req, res) {
  if(!checkUser(req)){
      res.redirect('/login');
    }
  res.render('index');
});

app.get('/links',
function(req, res) {
  if(!checkUser(req)){
      res.redirect('/login');
    }
  Links.reset().fetch().then(function(links) {
    //console.log("herrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrre",links);
    res.send(200, links.models);
  });
});

app.post('/links',
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });
        console.log(title)

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
app.post('/signup',
function(req, res) {

  new User({ username: req.body.username }).fetch().then(function(found) {
    if (found) {
      res.writeHead(303,{location: '/'});
      res.end();
    } else {
        //defined our salt
        var salt = (new Date()).toString();
        //http://nodejs.org/api/crypto.html#crypto_crypto_createhash_algorithm
        var hash = crypto.createHash('md5');
        //updates our password to include md5 hash
        hash.update(req.body.password);
        //updates our password to include salt
        hash.update(salt);
        console.log(hash.digest('hex'))

        var user = new User({
          username: req.body.username,
          //Calculates the digest of all of the passed data to be hashed
          password: hash.digest('hex'),
          salt: salt
        });

        user.save().then(function(newUser) {
          Users.add(newUser);
          res.writeHead(303,{location: '/'});
          res.end();
        });
      }
   });
});

app.post('/login',
  function(req,res) {
    //checking to see if username exists in database
    new User({ username: req.body.username }).fetch().then(function(found) {
      //if it exists, check to see if the password matches
      if(found){
        //create variable that represents our password stored in the database

        var hash = crypto.createHash('md5');
        //hashing our login password
        hash.update(req.body.password);
        //using the salt of our stored user to update login password
        hash.update(found.attributes.salt);
        console.log(hash);
        var password = hash.digest('hex');
        console.log(req.session.user);

        req.session.user = req.body.username;

        if(password === found.attributes.password){
          res.writeHead(303,{location: '/'});
          res.end();
       }
     }else{
        res.writeHead(303,{location: '/signup'});
        res.end();
     }
    })
  })

var checkUser = function(req){ //checks to make sure the user is legit
  if(req.session.user){
    return true;
  }
  else{
    return false;
  }
}


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
