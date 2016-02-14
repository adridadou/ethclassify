// tutorial10.js
var RequestList = React.createClass({
  render: function() {
    var requests = this.props.data.map(function(req) {
      return (
        <tr><td>{req.document}</td><td>{req.id}</td><td>{req.status}</td></tr>
      );
    });
    return (
      <table>
      <thead>
        <tr><th>document</th><th>request id</th><th>status</th></tr>
      </thead>
      <tbody>
        {requests}
      </tbody>
      </table>
    );
  }
});