

// tutorial10.js
"use strict";

var RequestList = React.createClass({
  displayName: "RequestList",

  render: function render() {
    var requests = this.props.data.map(function (req) {
      return React.createElement(
        "tr",
        null,
        React.createElement(
          "td",
          null,
          req.document
        ),
        React.createElement(
          "td",
          null,
          req.id
        ),
        React.createElement(
          "td",
          null,
          req.status
        )
      );
    });
    return React.createElement(
      "table",
      null,
      React.createElement(
        "thead",
        null,
        React.createElement(
          "tr",
          null,
          React.createElement(
            "th",
            null,
            "document"
          ),
          React.createElement(
            "th",
            null,
            "request id"
          ),
          React.createElement(
            "th",
            null,
            "status"
          )
        )
      ),
      React.createElement(
        "tbody",
        null,
        requests
      )
    );
  }
});