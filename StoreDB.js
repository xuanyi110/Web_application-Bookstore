var MongoClient = require('mongodb').MongoClient;	// require the mongodb driver

/**
 * Uses mongodb v3.1.9 - [API Documentation](http://mongodb.github.io/node-mongodb-native/3.1/api/)
 * StoreDB wraps a mongoDB connection to provide a higher-level abstraction layer
 * for manipulating the objects in our bookstore app.
 */
function StoreDB(mongoUrl, dbName){
	if (!(this instanceof StoreDB)) return new StoreDB(mongoUrl, dbName);
	this.connected = new Promise(function(resolve, reject){
		MongoClient.connect(
			mongoUrl,
			{
				useNewUrlParser: true
			},
			function(err, client){
				if (err) reject(err);
				else {
					console.log('[MongoClient] Connected to '+mongoUrl+'/'+dbName);
					resolve(client.db(dbName));
				}
			}
		)
	});
}

StoreDB.prototype.getProducts = function(queryParams){
	return this.connected.then(function(db){
        var query = {};
        if("minPrice" in queryParams) {
            query = {
                "price": {
                    $gte: parseInt(queryParams.minPrice)
                }
            }
        }
        if("maxPrice" in queryParams) {
            query = {
                "price": {
                    ...query["price"],
                    $lte: parseInt(queryParams.maxPrice)
                }
            }
        }
        if("category" in queryParams) {
            query = {
                ...query,
                category: queryParams.category 
            }
        }
        return db.collection("products").find(query).toArray().then(function(result) {
            var products = {};
            for(var product of result) {
                products[product._id] = product;
                delete product._id;
            }
            return products;
        }, function(err) {
            throw err;
        });
	})
}

StoreDB.prototype.addOrder = function(order){
	return this.connected.then(function(db){
        var cart = order.cart;
        var cartItemNames = Object.getOwnPropertyNames(cart);
        var promises = [];
        
        for(var i = 0; i < cartItemNames.length; i++) {
            var cartItemName = cartItemNames[i];
            var quantity = cart[cartItemName];
            promises.push(db.collection("products").findOne({
                "_id": cartItemName,
                "quantity" : { "$gte" : quantity }}));
        }

        return Promise.all(promises).then(function(results) {
            for(var i = 0; i < results.length; i++) {
                var result = results[i];
                if(!result) {
                    throw "Either " + cartItemNames[i] + " does not exist or quantity too low";
                }
            }

            for(var i = 0; i < cartItemNames.length; i++) {
                var cartItemName = cartItemNames[i];
                var quantity = order.cart[cartItemName];
                var updated = db.collection("products").updateOne(
                    {"_id" : cartItemName, "quantity": { "$gte" : quantity}},
                    {"$inc" : { "quantity" : -Math.abs(quantity) }});
                if(!updated || !updated.modifiedCount < 1) {
                    throw "Could not update " + cartItemName + " with quantity " + quantity;
                }
            }
            return db.collection("orders").insertOne(order).then(function(result) {
                if(!result || result.insertedCount !== 1 || typeof result.insertedId == "undefined") {
                    throw "Could not insert order";
                }
                return result.insertedId;
            });
        });
	})
}

module.exports = StoreDB;