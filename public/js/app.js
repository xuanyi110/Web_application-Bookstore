var displayed = [];

function ajaxGet(url, onSuccess, onError, count) {
    var errorCount = typeof count != 'undefined' ? count : 0;

    var errorCallback = function() {
        errorCount++;
        if(errorCount >= 3) {
            onError(req.response);
        } else {
            ajaxGet(url, onSuccess, onError, errorCount);
        }
    };

    var req = new XMLHttpRequest();
    req.open("GET", url);
    req.onload = function() {
        if(req.status === 200) {
            onSuccess(JSON.parse(req.response));
        } else {
            errorCallback();
        }
    };
    req.ontimeout = errorCallback;
    req.timeout = 1000;
    req.onerror = errorCallback;
    req.send();
}

function ajaxPost(url, data, onSuccess, onError) {
    var req = new XMLHttpRequest();
    req.open("POST", url);
    req.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    req.onload = function() {
        if(req.status === 200) {
            onSuccess(JSON.parse(req.response));
        } else {
            onError(req.response);
        }
    };
    req.ontimeout = onError;
    req.timeout = 1000;
    req.onerror = onError;
    req.send(JSON.stringify(data));
}

var Store = function(serverUrl) {
    this.serverUrl = serverUrl;
    this.cart = {};
    this.stock = {};
    this.onUpdate = null;
}

Store.prototype.checkOut = function(onFinish) {
    var self = this;
    this.syncWithServer(function(delta) {
        var itemNames = Object.getOwnPropertyNames(delta);
        if(itemNames.length > 0) {
            var alertString = "";
            for(var i = 0; i < itemNames.length; i++) {
                var itemName = itemNames[i];
                var item = delta[itemName];
                var stockItem = self.stock[itemName];
                if(typeof item.price != 'undefined') {
                    alertString = alertString + "Price of " + itemName + " changed from " + String(stockItem.price - item.price) + " to " + String(stockItem.price) + "\n";
                }
                if(typeof item.quantity != 'undefined') {
                    alertString = alertString + "Quantity of " + itemName + " changed from " + String(stockItem.quantity - item.quantity) + " to " + String(stockItem.quantity);
                }
            }
            alert(alertString);
        } else {
            var itemNames = Object.getOwnPropertyNames(self.cart);
            var totalPrice = 0;
            for(var i = 0; i < itemNames.length; i++) {
                var itemName = itemNames[i];
                var item = self.stock[itemName];
                var amount = self.cart[itemName];
                totalPrice += item.price * amount;
            }
            var order = {
                client_id: Math.random().toString(),
                cart: self.cart,
                total: totalPrice
            };
            ajaxPost(self.serverUrl + "/checkout", order, function() {
                alert("The items were successfully checked out");
                self.cart = {};
                self.onUpdate();
            }, function() {
                alert("There was an error trying to check out the items");
            });
        }
        if(typeof onFinish != 'undefined') {
            onFinish();
        }
    });
}

Store.prototype.syncWithServer = function(onSync) {
    var self = this;
    ajaxGet(this.serverUrl + "/products", function(items) {
        var delta = {};
        var itemNames = Object.getOwnPropertyNames(items);
        for(var i = 0; i < itemNames.length; i++) {
            var itemName = itemNames[i];
            var currentItem = self.stock[itemName];
            var newItem = items[itemName];
            var cartItem = self.cart[newItemName];
            if(typeof currentItem == 'undefined') {
                delta[itemName] = newItem;
            } else {
                if(currentItem.price !== newItem.price) {
                    if(typeof delta[itemName] == 'undefined') {
                        delta[itemName] = {};
                    }
                    delta[itemName].price = newItem.price - currentItem.price;
                }
                if(currentItem.imageUrl !== newItem.imageUrl) {
                    if(typeof delta[itemName] == 'undefined') {
                        delta[itemName] = {};
                    }
                    delta[itemName].imageUrl = newItem.imageUrl;
                }
                if(currentItem.label !== newItem.label) {
                    if(typeof delta[itemName] == 'undefined') {
                        delta[itemName] = {};
                    }
                    delta[itemName].label = newItem.label;
                }
                if(currentItem.quantity !== newItem.quantity
                    && (cartItem != 'undefined' && cartItem > 0 && oldItem.quantity + cartItem !== newItem.quantity)) {
                    if(delta[itemName] == 'undefined') {
                        delta[itemName] = {};
                    }
                    delta[itemName].quantity = newItem.quantity - currentItem.quantity;
                }
            }
        }

        var newItems = Object.getOwnPropertyNames(delta);

        for(var i = 0; i < newItems.length; i++) {
            var newItemName = newItems[i];
            var newItem = delta[newItemName];
            var oldItem = self.stock[newItemName];
            if(typeof oldItem == 'undefined') {
                self.stock[newItemName] = newItem;
            } else {
                if(typeof newItem.price != 'undefined') {
                    oldItem.price += newItem.price;
                }
                if(typeof newItem.quantity != 'undefined') {
                    oldItem.quantity += newItem.quantity;
                }
                if(typeof newItem.imageUrl != 'undefined') {
                    oldItem.imageUrl = newItem.imageUrl;
                }
                if(typeof newItem.label != 'undefined') {
                    oldItem.label = newItem.label;
                }
            }
        }

        if(self.onUpdate) {
            self.onUpdate();
        }

        if(typeof onSync != 'undefined') {
            onSync(delta);
        }

    }, function(error) {

    });
}

Store.prototype.addItemToCart = function(itemName) {
    inactiveTime = 0;
    if(this.stock.hasOwnProperty(itemName)
        && typeof this.stock[itemName].quantity != undefined
        && this.stock[itemName].quantity > 0) {
        this.stock[itemName].quantity--;
        if(this.cart.hasOwnProperty(itemName)) {
            this.cart[itemName]++;
        } else {
            this.cart[itemName] = 1;
        }
        this.onUpdate(itemName);
    }
}

Store.prototype.removeItemFromCart = function(itemName) {
    inactiveTime = 0;
    if(this.cart.hasOwnProperty(itemName)) {
        if(this.cart[itemName] === 1) {
            delete this.cart[itemName];
        } else {
            this.cart[itemName]--;
        }
        if(this.stock.hasOwnProperty(itemName)
            && typeof this.stock[itemName].quantity != undefined) {
            this.stock[itemName].quantity++;
        }
        this.onUpdate(itemName);
    }
}

renderCart = function(container, storeInstance) {
    var cart = storeInstance && typeof storeInstance["cart"] !== undefined ? storeInstance.cart : {};

    var table = document.createElement("table");
    table.id = "table-cart";

    container.innerHTML = "";
    container.appendChild(table);

    var trHeader = document.createElement("tr");
    var thName = document.createElement("th");
    var thCart = document.createElement("th");
    var thQuantity = document.createElement("th");
    var thPrice = document.createElement("th");
    var thAddRemove = document.createElement("th");

    thName.appendChild(document.createTextNode("Item"));
    thCart.appendChild(document.createTextNode("Cart"));
    thQuantity.appendChild(document.createTextNode("Quantity"));
    thPrice.appendChild(document.createTextNode("Price"));
    thAddRemove.appendChild(document.createTextNode("Add/Remove"));

    trHeader.appendChild(thName);
    trHeader.appendChild(thCart);
    trHeader.appendChild(thQuantity);
    trHeader.appendChild(thPrice);
    trHeader.appendChild(thAddRemove);
    table.appendChild(trHeader);

    var totalPrice = 0;
    var propNames = Object.getOwnPropertyNames(cart);
    for(var i = 0; i < propNames.length; i++) {
        var propName = propNames[i];
        var amount = cart[propName];
        var item = storeInstance.stock[propName];

        var trItem = document.createElement("tr");

        var tbName = document.createElement("td");
        tbName.appendChild(document.createTextNode(item.label));

        var tbCart = document.createElement("td");
        tbCart.appendChild(document.createTextNode(amount));

        var tbQuantity = document.createElement("td");
        tbQuantity.appendChild(document.createTextNode(item.quantity));
        
        var tbPrice = document.createElement("td");
        tbPrice.append(document.createTextNode("$" + item.price));

        var tbButtons = document.createElement("td");

        var btnAdd = document.createElement("button");
        var btnRemove = document.createElement("button");



        function addClickListeners(itemName) {
            btnAdd.addEventListener("click", function() {
                storeInstance.addItemToCart(itemName);
            });
            btnRemove.addEventListener("click", function() {
                storeInstance.removeItemFromCart(itemName);
            });
        }

        addClickListeners(propName);
        
        btnAdd.appendChild(document.createTextNode("+"));
        tbButtons.appendChild(btnAdd);
        btnRemove.appendChild(document.createTextNode("-"));
        tbButtons.appendChild(btnRemove);



        trItem.appendChild(tbName);
        trItem.appendChild(tbCart);
        trItem.appendChild(tbQuantity);
        trItem.appendChild(tbPrice);
        trItem.appendChild(tbButtons);
        table.appendChild(trItem);
        totalPrice += item.price * amount;
    }
    container.appendChild(document.createTextNode("Total Price: $" + totalPrice));

    var btnCheckOut = document.createElement("button");
    btnCheckOut.id = "btn-check-out";
    btnCheckOut.append(document.createTextNode("Check Out"));
    btnCheckOut.addEventListener("click", function(e) {
        var button = e.target;
        button.disabled = true;
        store.checkOut(function() {
            button.disabled = false;
        });
    });

    container.appendChild(btnCheckOut);
}

var store = new Store('http://localhost:3000');

var inactiveTime = 0;

showCart = function() {
    inactiveTime = 0;
    var modal = document.getElementById("modal");
    var modalContent = document.getElementById("modal-content");
    renderCart(modalContent, store);
    modal.classList.add("modal-visible");
}

hideCart = function() {
    var modal = document.getElementById("modal");
    modal.classList.remove("modal-visible");
}

inactivityTracker = function() {
    inactiveTime++;
    if(inactiveTime >= 1000) {
        alert('Hey there! Are you still planning to buy something?');
        inactiveTime = 0;
    }
};

setInterval(inactivityTracker, 1000);

var renderProduct = function(container, storeInstance, itemName){
    container.innerHTML = "";
    var storeItem = storeInstance.stock[itemName];

    var image = document.createElement("img");
    image.src = storeItem.imageUrl;

    image.classList.add("productImage");
    container.appendChild(image);

    var overlay = document.createElement("div");
    overlay.classList.add("overlay");
    container.appendChild(overlay);

    var overlayText = document.createElement("div");
    overlayText.classList.add("overlayText");
    overlay.appendChild(overlayText);
    overlayText.appendChild(document.createTextNode("$" + storeItem.price));

    container.appendChild(document.createTextNode(storeItem.label));

    var buttonContainer = document.createElement("div");
    buttonContainer.classList.add("buttonContainer");
    container.appendChild(buttonContainer);

    if(storeItem.quantity > 0) {
        var btnAdd = document.createElement("button");
        btnAdd.classList.add("btn-add");
        btnAdd.addEventListener("click", function() {
            storeInstance.addItemToCart(itemName);
        });
        buttonContainer.appendChild(btnAdd);
        btnAdd.appendChild(document.createTextNode("Add to cart"));
    }

    if(storeInstance.cart[itemName] > 0) {
        var btnRemove = document.createElement("button");
        btnRemove.classList.add("btn-remove");
        btnRemove.addEventListener("click", function() {
            storeInstance.removeItemFromCart(itemName);
        });
        buttonContainer.appendChild(btnRemove);
        btnRemove.appendChild(document.createTextNode("Remove from cart"));
    }
}

var renderProductList = function(container, storeInstance) {
    var productList = document.createElement("ul");
    container.innerHTML = "";

    container.appendChild(productList);

    // the products is an array now

    for (var i = 0; i < displayed.length; i++) {
      var product = document.createElement("li");
      product.classList.add("product");
      product.id = "product-" +  displayed[i];
      productList.appendChild(product);
      renderProduct(product, storeInstance, displayed[i]);
    }
}

store.onUpdate = function(itemName) {
    if(!itemName || typeof itemName == 'undefined') {
        renderProductList(document.getElementById("productView"), store);
    } else {
        var product = document.getElementById("product-" + itemName);
        renderProduct(product, this, itemName);
    }
    var modalContent = document.getElementById("modal-content");
    renderCart(modalContent, this);
    renderMenu(document.getElementById("menuView"), store);
}

Store.prototype.queryProducts = function(query, callback){
	var self = this;
	var queryString = Object.keys(query).reduce(function(acc, key){
			return acc + (query[key] ? ((acc ? '&':'') + key + '=' + query[key]) : '');
		}, '');
	ajaxGet(this.serverUrl+"/products?"+queryString,
		function(products){
			Object.keys(products)
				.forEach(function(itemName){
					var rem = products[itemName].quantity - (self.cart[itemName] || 0);
					if (rem >= 0){
						self.stock[itemName].quantity = rem;
					}
					else {
						self.stock[itemName].quantity = 0;
						self.cart[itemName] = products[itemName].quantity;
						if (self.cart[itemName] === 0) delete self.cart[itemName];
					}
					
					self.stock[itemName] = Object.assign(self.stock[itemName], {
						price: products[itemName].price,
						label: products[itemName].label,
						imageUrl: products[itemName].imageUrl
					});
				});
			self.onUpdate();
			callback(null, products);
		},
		function(error){
			callback(error);
		}
	)
}

function renderMenu(container, storeInstance){
	while (container.lastChild) container.removeChild(container.lastChild);
	if (!container._filters) {
		container._filters = {
			minPrice: null,
			maxPrice: null,
			category: ''
		};
		container._refresh = function(){
			storeInstance.queryProducts(container._filters, function(err, products){
					if (err){
						alert('Error occurred trying to query products');
						console.log(err);
					}
					else {
						displayed = Object.keys(products);
						renderProductList(document.getElementById('productView'), storeInstance);
					}
				});
		}
	}

	var box = document.createElement('div'); container.appendChild(box);
		box.id = 'price-filter';
		var input = document.createElement('input'); box.appendChild(input);
			input.type = 'number';
			input.value = container._filters.minPrice;
			input.min = 0;
			input.placeholder = 'Min Price';
			input.addEventListener('blur', function(event){
				container._filters.minPrice = event.target.value;
				container._refresh();
			});

		input = document.createElement('input'); box.appendChild(input);
			input.type = 'number';
			input.value = container._filters.maxPrice;
			input.min = 0;
			input.placeholder = 'Max Price';
			input.addEventListener('blur', function(event){
				container._filters.maxPrice = event.target.value;
				container._refresh();
			});

	var list = document.createElement('ul'); container.appendChild(list);
		list.id = 'menu';
		var listItem = document.createElement('li'); list.appendChild(listItem);
			listItem.className = 'menuItem' + (container._filters.category === '' ? ' active': '');
			listItem.appendChild(document.createTextNode('All Items'));
			listItem.addEventListener('click', function(event){
				container._filters.category = '';
				container._refresh()
			});
	var CATEGORIES = [ 'Clothing', 'Technology', 'Office', 'Outdoor' ];
	for (var i in CATEGORIES){
		var listItem = document.createElement('li'); list.appendChild(listItem);
			listItem.className = 'menuItem' + (container._filters.category === CATEGORIES[i] ? ' active': '');
			listItem.appendChild(document.createTextNode(CATEGORIES[i]));
			listItem.addEventListener('click', (function(i){
				return function(event){
					container._filters.category = CATEGORIES[i];
					container._refresh();
				}
			})(i));
	}
}

window.onload = function(){
    document.onkeydown = function(e) {
        e = e || window.event;
        if((typeof e["key"] !== undefined && e.key === "Escape" || e.key === "Esc") || 
        (typeof e["keyCode"] !== undefined && e.keyCode === 27)) {
            hideCart();
        }
    };
    store.syncWithServer(function(delta) {
        displayed = Object.getOwnPropertyNames(delta);
        renderProductList(document.getElementById("productView"), store);
    });
}