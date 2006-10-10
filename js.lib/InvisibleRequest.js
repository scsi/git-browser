/*
Copyright (C) 2005, Artem Khodush <greenkaa@gmail.com>

This file is licensed under the GNU General Public License version 2.
*/

if( typeof( InvisibleRequest )=="undefined" ) {
	InvisibleRequest={};
}

InvisibleRequest._g_iframe=null;
InvisibleRequest._g_iframe_element=null;
InvisibleRequest._g_queue=[];
InvisibleRequest._g_timeout_seconds=5;
InvisibleRequest._g_timeout_message="timeout";

/*
named arguments:
url: url to get. must be either absolute (start with protocol://) or should not contain path at all (no /).
	in the latter case, path from current document is prepended to url.
handler: response handler. takes two arguments: response document and handler_arg
error_handler: called on error, or when timeout_seconds have passed and responce is not received
	takes two arguments: error message and handler_arg
handler_arg: optional, second argument for handler and error_handler
timeout_seconds: optional, time to wait for a response
*/
InvisibleRequest.get=function( request )
{
	// put the request in the queue
	if( request.timeout_seconds==null ) {
		request.timeout_seconds=InvisibleRequest._g_timeout_seconds;
	}
	// if url is realtive, append the base from current document
	if( request.url.indexOf( "/" )==-1 ) { // no way to specify relative paths here - they will be normalized on server, and the result will not match the comparison in the handle_responce
		var base_url=document.location.href;
		var slash_pos=base_url.lastIndexOf( "/" );
		if( slash_pos!=-1 ) {
			request.url=base_url.substring( 0, slash_pos+1 )+request.url;
		}
	}
	InvisibleRequest._g_queue.push( request );
	if( InvisibleRequest._g_queue.length==1 ) {
		if( InvisibleRequest._g_iframe==null ) {
			InvisibleRequest._init();
		}else {
			// issue the request right now, if there were no other penging requests in the queue
			InvisibleRequest._issue();
		}
	}
}

InvisibleRequest.set_default_timeout=function( timeout_seconds )
{
	InvisibleRequest._g_timeout_seconds=timeout_seconds;
}

InvisibleRequest._init=function()
{
	try {
		var iframe_element=document.createElement( "iframe" );
		iframe_element.width=1;
		iframe_element.height=1;
		if( window.opera ) {
			iframe_element.style.visibility="hidden"; // diplay=none suppress onload from firing in Opera
		}else {
			iframe_element.style.display="none";
		}
		if( iframe_element.attachEvent ) {
			iframe_element.attachEvent( 'onload', InvisibleRequest._iframe_onload );
		}else {
			iframe_element.onload=InvisibleRequest._iframe_onload;
		}
		// the iframe that createElement creates is not the real iframe. In mozilla and IE it even does not have a location.
		// find the real one.

		iframe_element._invisible_request_tag=1;

		document.body.appendChild( iframe_element );
		InvisibleRequest._g_iframe_element=iframe_element;
		// initialization will be finished when the iframe_onload will be called (in IE, mozilla and opera, it WILL be called right here).
	}catch(e) {
		var s=typeof( e )+": ";
		if( e.description!=null ) {
			s+=e.description;
		}else if( e.message!=null ) {
			s+=e.message;
		}else {
			s+=e.toString();
		}
		InvisibleRequest._handle_response( InvisibleRequest._g_queue[0].url, s );
	}
}

InvisibleRequest._iframe_onload=function()
{
	if( InvisibleRequest._g_iframe==null ) { // continue initialization
		// The iframe that createElement has created is not the real iframe.
		// Assignment to its location will do no good.
		// Find the real iframe.
		var i;
		for( i=0; i<window.frames.length; ++i ) {
			var fe=0;
			try {
				fe=window.frames[i].frameElement;
			}catch( e ) { // ignore spurious security errors on opera 7
			}
			if( fe._invisible_request_tag==1 ) { // works in mozilla and IE
				InvisibleRequest._g_iframe=window.frames[i];
				break;
			}else if( this.document!=null ) {
				var fd=1;
				try {
					fd=window.frames[i].document;
				}catch(e) {
				}
				if( this.document==fd ) { // works in opera
					InvisibleRequest._g_iframe=window.frames[i];
					break;
				}
			}
		}
		if( InvisibleRequest._g_iframe==null ) {
			InvisibleRequest._handle_response( InvisibleRequest._g_queue[0].url, "init failed: unable to create proper iframe" );
		}else {
			// initialized, go on with our business
			InvisibleRequest._issue();
		}
	}else { // initialized already
		if( InvisibleRequest._g_iframe.location!=null ) {
			var location=InvisibleRequest._g_iframe.location.href;
			if( location!="" && location!="about:blank" ) { // avoid indefinite recursion
				InvisibleRequest._handle_response( location );
			}
		}
	}
}

InvisibleRequest._handle_response=function( url, error )
{
	// find the first request in the queue with matching url, if found, handle it
	var handled=0;
	for( var i=0; i<InvisibleRequest._g_queue.length; ++i ) {
		var request=InvisibleRequest._g_queue[i];
		if( request.url==url ) {
			clearTimeout( request._invisible_request_timeout );
			try {
				if( error==null ) {
					request.handler( InvisibleRequest._g_iframe.document, request.handler_arg ); // XXX is there a way to reliably detect, say, 404 errors from the document? (headers??)
				}else {
					request.error_handler( "invisible_get: "+error+" requesting "+request.url, request.handler_arg );
				}
			}catch( e ) {
			}
			// remove the request from the queue
			InvisibleRequest._g_queue.splice( i, 1 );

			handled=1;
			break;
		}
	}

	// issue the next request, if the previos one was handled, and there are more
	if( handled && InvisibleRequest._g_queue.length>0 ) {
		InvisibleRequest._issue();
	}else {
		if( InvisibleRequest._g_iframe.location!=null ) { // defence against opera 8 (see comment in InvisibleRequest._issue)
			InvisibleRequest._g_iframe.location.replace( "about:blank" ); // if the iframe is left pointing to the url, it will be reloaded each time the user hits the "reload page" button
		}
	}
}

InvisibleRequest._issue=function()
{
	// take the first request
	var request=InvisibleRequest._g_queue[0];
	request._invisible_request_timeout=setTimeout( "InvisibleRequest._handle_response( \""+request.url+"\", InvisibleRequest._g_timeout_message );",
										request.timeout_seconds*1000
									);
	try {
		if( InvisibleRequest._g_iframe.location==null ) {
			// opera: after loading url with invalid hostname into the iframe, the iframe.location becomes null, and iframe.location.replace craps out.
			// to overcome that crap, just assign the location, at the price of spoiling browser history.
			// moreover, in opera 8, assigning to iframe.location after it became null does nothing, one  needs to assign to the iframe element src.
			InvisibleRequest._g_iframe_element.src=request.url;
		}else {
			InvisibleRequest._g_iframe.location.replace( request.url );
		}
	}catch( e ) {
		var s=typeof( e )+": ";
		if( e.description!=null ) {
			s+=e.description;
		}else if( e.message!=null ) {
			s+=e.message;
		}else {
			s+=e.toString();
		}
		InvisibleRequest._handle_response( request.url, s );
	}
}

// code for requesting html page fragments and keeping them in cache
// it looks up fragments by their ids
// only fragments that are immideately below <body> are found
InvisibleRequest._g_element_cache={}; // url => { elements from that url }
InvisibleRequest._g_element_pending_urls={}; // url => [ pending element_requests ]

InvisibleRequest._element_handle_from_cache=function( element_request )
{
	var node=InvisibleRequest._g_element_cache[element_request.url][element_request.element_id];
	if( node==null ) {
		element_request.error_handler( "requested element with id "+element_request.element_id+" is not found in the document "+element_request.url );
	}else {
		element_request.handler( node, element_request.handler_arg );
	}
}

InvisibleRequest._element_handler=function( doc, url )
{
	var requests=InvisibleRequest._g_element_pending_urls[url];
	if( requests!=null ) {
		// put elements from the document into the cache
		var msg="";
		var body=doc.getElementsByTagName( "BODY" );
		if( body.length==0 ) {
			msg="invisible_get_element: no body in the document at "+url;
		}else {
			InvisibleRequest._g_element_cache[url]={};
			for( var node=body[0].firstChild; node!=null; node=node.nextSibling ) {
				if( node.id!="" && node.id!=null ) {
					var new_node;
					// browser-specific way to import node from another document
					if( document.importNode!=null ) {
						new_node=document.importNode( node, true );
					}else if( node.outerHTML!=null ) {
						var span=document.createElement( "SPAN" );
						span.innerHTML=node.outerHTML;
						new_node=span.firstChild.cloneNode( true );
					}else {
						msg="invisible_get_element: your browser does not support neither document.importNode nor node.outerHTML - you're screwed";
						break;
					}
					InvisibleRequest._g_element_cache[url][node.id]=new_node;
				}
			}
		}
		// handle them all
		for( var i=0; i<requests.length; ++i ) {
			var request=requests[i]
			if( msg!="" ) {
				request.error_handler( msg, request.handler_arg );
			}else {
				InvisibleRequest._element_handle_from_cache( request );
			}
		}
		delete InvisibleRequest._g_element_pending_urls[url];
	}
}

InvisibleRequest._element_error_handler=function( msg, url )
{
	var requests=InvisibleRequest._g_element_pending_urls[url];
	// tell them all
	if( requests!=null ) {
		for( var i=0; i<requests.length; ++i ) {
			requests[i].error_handler( msg, requests[i].handler_arg );
		}
		delete InvisibleRequest._g_element_pending_urls[url];
	}
}

/*
named args:
url: document that contains the requested element
element_id: id of the requested element. element should be a direct child of a document.body
handler: takes two arguments: element node and handler_arg
error_handler: takes two arguments: error message and handler_arg
handler_arg: optional, second argument for handler and error_handler
timeout_seconds: optional, seconds to wait for a response

each url is requested only once, elements from the response document are kept in the cache indefinitely
and are always returned from the cache on subsequent requests .
*/
InvisibleRequest.get_element=function( element_request )
{
	var url=element_request.url;
	if( InvisibleRequest._g_element_cache[url]!=null ) {
		InvisibleRequest._element_handle_from_cache( element_request );
	}else if( InvisibleRequest._g_element_pending_urls[url]!=null ) {
		InvisibleRequest._g_element_pending_urls[url].push( element_request );
	}else {
		InvisibleRequest._g_element_pending_urls[url]=[ element_request ];
		InvisibleRequest.get( { url: element_request.url,
					handler: InvisibleRequest._element_handler,
					error_handler: InvisibleRequest._element_error_handler,
					handler_arg: element_request.url,
					timeout: element_request.timeout
				} );
	}
}
