// Require dependencies
var path = require('path');
var express = require('express');
var StoreDB = require('./StoreDB');

var db = new StoreDB("mongodb://127.0.0.1:27017", "cpen400a-bookstore");

// Declare application parameters
var PORT = process.env.PORT || 3000;
var STATIC_ROOT = path.resolve(__dirname, './public');

// Defining CORS middleware to enable CORS.
// (should really be using "express-cors",
// but this function is provided to show what is really going on when we say "we enable CORS")
function cors(req, res, next){
    res.header("Access-Control-Allow-Origin", "*");
  	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  	res.header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS,PUT");
  	next();
}

// Instantiate an express.js application
var app = express();

// Configure the app to use a bunch of middlewares
app.use(express.json());							// handles JSON payload
app.use(express.urlencoded({ extended : true }));	// handles URL encoded payload
app.use(cors);										// Enable CORS

app.use('/', express.static(STATIC_ROOT));			// Serve STATIC_ROOT at URL "/" as a static resource

// Configure '/products' endpoint
app.get('/products', function(request, response, next) {
	return db.getProducts(request.query).then(function(result) {
		return response.json(result);
	}, function(err) {
		response.statusCode = 500;
		next(err);
	})
});

app.post('/checkout', function(request, response, next) {
	
	var order = request.body;

	var sanitize = [
		{
			key: "client_id",
			type: "string"
		},
		{
			key: "cart",
			type: "object"
		},
		{
			key: "total",
			type: "number"
		}
	]
	
	var sanitizedError;

	for(var i = 0; i < sanitize.length; i++) {
		var s = sanitize[i];
		if(!(s.key in order) || typeof order[s.key] != s.type) {
			sanitizedError = "Error in " + s.key + " of type " + s.type;
			break;
		}
	}

	if(sanitizedError) {
		response.statusCode = 500;
		next(sanitizedError);
	} else {
		return db.addOrder(order).then(function (result) {
			return response.json({id: result});
		}, function(err) {
			response.statusCode = 500;
			next(err);
		});
	}
});

// Start listening on TCP port
app.listen(PORT, function(){
	console.log('Express.js server started, listening on PORT '+PORT)
});