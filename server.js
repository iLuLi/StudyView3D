var express = require( 'express' );
var app = express();

app.use( express.static( './' ) );

app.listen( 4000, function () {

	console.log( 'qidong' );

} );
