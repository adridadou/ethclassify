"use strict";

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var factory = function factory(Pudding) {
  // Inherit from Pudding. The dependency on Babel sucks, but it's
  // the easiest way to extend a Babel-based class. Note that the
  // resulting .js file does not have a dependency on Babel.

  var Document = (function (_Pudding) {
    _inherits(Document, _Pudding);

    function Document() {
      _classCallCheck(this, Document);

      _get(Object.getPrototypeOf(Document.prototype), "constructor", this).apply(this, arguments);
    }

    return Document;
  })(Pudding);

  ;

  // Set up specific data for this class.
  Document.abi = [{ "constant": false, "inputs": [], "name": "requestDocument", "outputs": [{ "name": "nb", "type": "uint256" }], "type": "function" }, { "constant": true, "inputs": [], "name": "document", "outputs": [{ "name": "", "type": "string" }], "type": "function" }, { "constant": true, "inputs": [], "name": "nbRequests", "outputs": [{ "name": "", "type": "uint256" }], "type": "function" }, { "constant": true, "inputs": [], "name": "privateKey", "outputs": [{ "name": "", "type": "string" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "requestId", "type": "uint256" }], "name": "getRequestOwner", "outputs": [{ "name": "_owner", "type": "address" }], "type": "function" }, { "constant": true, "inputs": [], "name": "owner", "outputs": [{ "name": "", "type": "address" }], "type": "function" }, { "inputs": [{ "name": "ipfs", "type": "string" }], "type": "constructor" }];
  Document.binary = "60606040526040516103493803806103498339810160405280510160605160008054600160a060020a0319163317815582516001805492819052926020601f6002600019868816156101000201909516949094048401047fb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf69081019390916080019083901060bd57805160ff19168380011785555b5060ac9291505b8082111560ea57600081558301609b565b50505061025b806100ee6000396000f35b828001600101855582156094579182015b82811115609457825182600050559160200191906001019060ce565b509056606060405236156100565760e060020a60003504631325070f81146100585780631f4339d81461009a5780631ff9e178146100f657806349da5a0f146100ff5780638611cb671461015b5780638da5cb5b14610195575b005b600280546001018082556000908152600460205260409020805474ffffffffffffffffffffffffffffffffffffffffff191633179055545b6060908152602090f35b6101a7600180546020600282841615610100026000190190921691909104601f810182900490910260809081016040526060828152929190828280156102535780601f1061022857610100808354040283529160200191610253565b61009060025481565b6101a7600380546020601f600260001960018516156101000201909316929092049182018190040260809081016040526060828152929190828280156102535780601f1061022857610100808354040283529160200191610253565b6102156004356000805433600160a060020a03908116911614156101905781815260046020526040902054600160a060020a03165b919050565b610215600054600160a060020a031681565b60405180806020018281038252838181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f1680156102075780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b600160a060020a03166060908152602090f35b820191906000526020600020905b81548152906001019060200180831161023657829003601f168201915b50505050508156";

  if ("0x09e65c4c502d925f0c1600d52573d7d7a288f4fe" != "") {
    Document.address = "0x09e65c4c502d925f0c1600d52573d7d7a288f4fe";

    // Backward compatibility; Deprecated.
    Document.deployed_address = "0x09e65c4c502d925f0c1600d52573d7d7a288f4fe";
  }

  Document.generated_with = "1.0.3";
  Document.contract_name = "Document";

  return Document;
};

// Nicety for Node.
factory.load = factory;

if (typeof module != "undefined") {
  module.exports = factory;
} else {
  // There will only be one version of Pudding in the browser,
  // and we can use that.
  window.Document = factory;
}