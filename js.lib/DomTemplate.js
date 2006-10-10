/*
Copyright (C) 2005, Artem Khodush <greenkaa@gmail.com>

This file is licensed under the GNU General Public License version 2.
*/

if( typeof( DomTemplate )=="undefined" ) {
	DomTemplate={};
}

DomTemplate._g_id_counter=1;

DomTemplate.apply=function( template, data, result, insert_before_node )
{
	var assign_id=false;
	if( result==null ) {
		assign_id=true;
		result=template.cloneNode( false );
		insert_before_node=null;
	}
	DomTemplate._fill_result_node( template, data, result, assign_id, insert_before_node );
	return result;
}
DomTemplate._create_result_subnode=function( template, data, result, insert_before_node )
{
	var result_child=template.cloneNode( false );
	if( insert_before_node==null ) {
		result.appendChild( result_child );
	}else {
		result.insertBefore( result_child, insert_before_node );
	}
	DomTemplate._fill_result_node( template, data, result_child, true, null );
}
DomTemplate._fill_result_node=function( template, data, new_node, assign_id, insert_before_node )
{
	var child_node=template.firstChild;
	var text_replaced=false;
	while( child_node!=null ) {
		if( child_node.nodeType==3 ) { // it's a text node
			var text=child_node.nodeValue;
			if( !text_replaced && data["_text"]!=null ) {
				text=data["_text"];
				text_replaced=true;
			}
			var text_node=new_node.ownerDocument.createTextNode( text );
			if( insert_before_node==null ) {
				new_node.appendChild( text_node );
			}else {
				new_node.insertBefore( text_node, insert_before_node );
			}
		}else if( child_node.nodeType==1 ) { // it's HTML node
			if( child_node.id=="" ) { // it's an HTML element without an id -
				// apply the same (parent) data for all its child nodes
				DomTemplate._create_result_subnode( child_node, data, new_node, insert_before_node );
			}else { // it's HTML element with an id - find its data and apply them,
				// omit this element if no data for it is specified
				var child_data=data[child_node.id];
				if( child_data!=null ) {
					if( typeof( child_data )=="string" ) { // a shortcut
						DomTemplate._create_result_subnode( child_node, {_text: child_data}, new_node, insert_before_node );
					}else {
						var is_array=false;
						for( var i in child_data ) {  // check whether child_data is an array - lame, but works, contrary to typeof()
							if( !is_array && i==0 ) {
								is_array=true;
							}else if( !is_array ) {
								break;
							}
							DomTemplate._create_result_subnode( child_node, child_data[i], new_node, insert_before_node );
						}
						if( !is_array ) { // child_data is assumed to be an object
							DomTemplate._create_result_subnode( child_node, child_data, new_node, insert_before_node );
						}
					}
				}
			}
		}
		child_node=child_node.nextSibling;
	}
	if( !text_replaced && data["_text"]!=null ) {
		var text_node=new_node.ownerDocument.createTextNode( data["_text"] );
		if( insert_before_node==null ) {
			new_node.appendChild( text_node );
		}else {
			new_node.insertBefore( text_node, insert_before_node );
		}
	}
	if( template.id!="" ) {
		if( assign_id ) {
			new_node.id=template.id+DomTemplate._g_id_counter.toString();
			++DomTemplate._g_id_counter;
		}
		for( var i in data ) {
			if( i.charAt( 0 )=="_" ) { // check for 'special' ids
				if( i=="_process" ) {
					data[i]( new_node, typeof( data["_process_arg"] )=="undefined" ? null : data["_process_arg"] );
				}else if( i=="_process_arg" ) {
				}else if( i=="_text" ) {
				}else {
					var attr_name=i.substring( 1 );
					if( attr_name=="class" ) {
						new_node.setAttribute( "className", data[i] );
						new_node.setAttribute( "class", data[i] ); 					
					}else {
						var attr_names=attr_name.split( "." );
						var split_index=0;
						var target_object=new_node;
						while( split_index+1<attr_names.length && target_object!=null ) {
							target_object=target_object[attr_names[split_index]];
							++split_index;
						}
						if( target_object!=null ) {
							if( split_index>0 ) {
								target_object[attr_names[split_index]]=data[i];
							}else { // for compatibility with previous behavior
								target_object.setAttribute( attr_names[split_index], data[i] );
							}
						}
					}
				}
			}
		}
	}
	if( data._replicate!=null ) {
		for( var rep_i=0; rep_i<data._replicate.length; ++rep_i ) {
			var rep_node=template.ownerDocument.getElementById( data._replicate[rep_i].name );
			if( rep_node!=null && rep_node.parentNode==template ) { // replicate only at the appropriate nesting level
				DomTemplate._create_result_subnode( rep_node, data._replicate[rep_i].data, new_node, insert_before_node );
			}
		}
	}
}
