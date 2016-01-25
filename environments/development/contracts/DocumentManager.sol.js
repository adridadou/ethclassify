"use strict";

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var factory = function factory(Pudding) {
  // Inherit from Pudding. The dependency on Babel sucks, but it's
  // the easiest way to extend a Babel-based class. Note that the
  // resulting .js file does not have a dependency on Babel.

  var DocumentManager = (function (_Pudding) {
    _inherits(DocumentManager, _Pudding);

    function DocumentManager() {
      _classCallCheck(this, DocumentManager);

      _get(Object.getPrototypeOf(DocumentManager.prototype), "constructor", this).apply(this, arguments);
    }

    return DocumentManager;
  })(Pudding);

  ;

  // Set up specific data for this class.
  DocumentManager.abi = [{ "constant": true, "inputs": [], "name": "owner", "outputs": [{ "name": "", "type": "address" }], "type": "function" }, { "constant": true, "inputs": [], "name": "nbDocuments", "outputs": [{ "name": "", "type": "uint256" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "documentId", "type": "uint256" }, { "name": "publicKey", "type": "string" }], "name": "requestDocument", "outputs": [{ "name": "nb", "type": "uint256" }], "type": "function" }, { "inputs": [], "type": "constructor" }];
  DocumentManager.binary = "606060405260028054600160a060020a031916331790556101c7806100246000396000f3606060405260e060020a60003504638da5cb5b811461003157806399dc8dbd14610050578063a6b2df9b14610059575b005b61014c60025473ffffffffffffffffffffffffffffffffffffffff1681565b61015660015481565b602060046024803582810135601f8101859004909402608090810160405260608581526101569585359594604494929392019181908382808284375094965050505050505060008281526020818152604080832060038101805460019081019182905590855260059091018352908320805474ffffffffffffffffffffffffffffffffffffffffff1916331781558451818301805481875285872093959194600260001991831615610100029190910190911604601f908101919091048301929060809083901061016857805160ff19168380011785555b506101989291505b808211156101c357858155600101610139565b6060908152602090f35b60408051918252519081900360200190f35b82800160010185558215610131579182015b8281111561013157825182600050559160200191906001019061017a565b5050600060005060008581526020019081526020016000206000506003016000505491505092915050565b509056";

  if ("" != "") {
    DocumentManager.address = "";

    // Backward compatibility; Deprecated.
    DocumentManager.deployed_address = "";
  }

  DocumentManager.generated_with = "1.0.3";
  DocumentManager.contract_name = "DocumentManager";

  return DocumentManager;
};

// Nicety for Node.
factory.load = factory;

if (typeof module != "undefined") {
  module.exports = factory;
} else {
  // There will only be one version of Pudding in the browser,
  // and we can use that.
  window.DocumentManager = factory;
}