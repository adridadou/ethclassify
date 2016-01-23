"use strict";

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var factory = function factory(Pudding) {
  // Inherit from Pudding. The dependency on Babel sucks, but it's
  // the easiest way to extend a Babel-based class. Note that the
  // resulting .js file does not have a dependency on Babel.

  var PublishedDocument = (function (_Pudding) {
    _inherits(PublishedDocument, _Pudding);

    function PublishedDocument() {
      _classCallCheck(this, PublishedDocument);

      _get(Object.getPrototypeOf(PublishedDocument.prototype), "constructor", this).apply(this, arguments);
    }

    return PublishedDocument;
  })(Pudding);

  ;

  // Set up specific data for this class.
  PublishedDocument.abi = [{ "inputs": [{ "name": "ipfsDocument", "type": "string" }], "type": "constructor" }];
  PublishedDocument.binary = "606060405260405160f038038060f08339810160405280510160605160008054600160a060020a0319163317815582516001805492819052926020601f6002600019868816156101000201909516949094048401047fb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf69081019390916080019083901060b957805160ff19168380011785555b5060aa9291505b8082111560e6576000815583016099565b50505060068060ea6000396000f35b828001600101855582156092579182015b82811115609257825182600050559160200191906001019060ca565b509056606060405200";

  if ("" != "") {
    PublishedDocument.address = "";

    // Backward compatibility; Deprecated.
    PublishedDocument.deployed_address = "";
  }

  PublishedDocument.generated_with = "1.0.3";
  PublishedDocument.contract_name = "PublishedDocument";

  return PublishedDocument;
};

// Nicety for Node.
factory.load = factory;

if (typeof module != "undefined") {
  module.exports = factory;
} else {
  // There will only be one version of Pudding in the browser,
  // and we can use that.
  window.PublishedDocument = factory;
}