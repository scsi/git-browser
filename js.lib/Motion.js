/*
Copyright (C) 2005, Artem Khodush <greenkaa@gmail.com>

This file is licensed under the GNU General Public License version 2.
*/

if( typeof( Motion )=="undefined" ) {
	Motion={};
}

Motion.get_page_coords=function( elm, no_scroll )
{
	var point={ x: 0, y: 0 };
	while( elm ) {
		point.x+=elm.offsetLeft;
		point.y+=elm.offsetTop;
		if( no_scroll==null && !no_scroll ) {	// XXX: there are cases when subtracting scrollLeft and scrollTop is wrong, e.g. when anything other than body is scrolled,
			point.x-=elm.scrollLeft;		// and the position relative to something that is not scrolled is required.
			point.y-=elm.scrollTop;
		}
		elm=elm.offsetParent;
	}
	return point;
}
Motion.set_page_coords=function( elm, x, y, no_scroll )
{
	var parent_coords={ x: 0, y: 0 };
	var phony_ie_access=elm.document; // without accessing elm.document first, sometimes IE silently breaks on accessing offsetParent.
	if( elm.offsetParent )  {
		parent_coords=Motion.get_page_coords( elm.offsetParent, no_scroll );
	}
	var new_x=x-parent_coords.x;
	elm.style.left=new_x+'px';
	var new_y=y-parent_coords.y;
	elm.style.top=new_y+'px';
}

// bind HTML node with arbitrary object
// stores objects in an array
// stores two integer properties in the node for object identification
// each ObjectBinder should have unique key
Motion.ObjectBinder=function( key )
{
	this.m_id_property="_motion_bind_"+key+"_id";
	this.m_generation_property="_motion_bind_"+key+"_generation";
	this.m_objects=[];
	this.m_generation_counter=0;
}
Motion.ObjectBinder.prototype.bind_object=function( node, object )
{
	var id=null;
	var node_id=node[this.m_id_property];
	var node_generation=node[this.m_generation_property];
	if( node_id!=null && node_generation!=null ) {
		var data=this.m_objects[node_id];
		if( data!=null && data.generation==node_generation ) {
			id=node_id;
		}
	}
	if( id==null ) {
		id=0;
		while( id!=this.m_objects.length ) {
			if( this.m_objects[id]==null ) {
				break;
			}
			++id;
		}
		node[this.m_id_property]=id;
		node[this.m_generation_property]=++this.m_generation_counter;
	}
	this.m_objects[id]={ object: object, generation: node[this.m_generation_property] };
	return id;
}
Motion.ObjectBinder.prototype.bind_same_object=function( id, node )
{
	var data=this.m_objects[id];
	if( data!=null ) {
		node[this.m_id_property]=id;
		node[this.m_generation_property]=data.generation;
		data=data.object;
	}
	return data;
}
Motion.ObjectBinder.prototype._find_data=function( node )
{
	var node_id=node[this.m_id_property];
	var node_generation=node[this.m_generation_property];
	if( node_id!=null && node_generation!=null ) {
		var data=this.m_objects[node_id];
		if( data!=null && data.generation==node_generation ) {
			return data;
		}
	}
	return null;
}
Motion.ObjectBinder.prototype.find_object=function( node )
{
	var data=this._find_data( node );
	return data==null ? null : data.object;
}
Motion.ObjectBinder.prototype.unbind_object=function( node )
{
	var data=this._find_data( node );
	if( data!=null ) {
		this.m_objects[node[this.m_id_property]]=null;
		return data.object;
	}
	return null;
}
Motion.ObjectBinder.prototype.unbind_all=function()
{
	this.m_objects=[];
}

// track_enter_leave
Motion._g_enter_leave_binder=new Motion.ObjectBinder( "enter_leave" );

Motion._is_child_of=function( child, parent )
{
	var p=child;
	while( p!=null ) {
		if( p==parent ) {
			return true;
		}
		p=p.parentNode;
	}
	return false;
}
Motion._on_mouseover=function( event )
{
	var arg=Motion._g_enter_leave_binder.find_object( this );
	if( arg!=null ) {
		if( event==null ) {
			event=window.event;
		}
		var from=document.body; // arbitrary - when in doubt, always fire
		if( event.relatedTarget ) {
			from=event.relatedTarget;
		}else if( event.passThroughRelatedTarget ) { // workaround for mozilla bug that spoils replay_event in run-tests.html
			from=event.passThroughRelatedTarget;
		}else if( event.fromElement ) {
			from=event.fromElement;
		}
		var target=this;
		if( event.target ) {
			target=event.target;
		}else if( event.srcElement ) {
			target=event.srcElement;
		}
		var internal=Motion._is_child_of( from, this ) && Motion._is_child_of( target, this );
		if( !internal ) {
			arg.enter_handler( this, arg.handler_arg );
		}
	}
}
Motion._on_mouseout=function( event )
{
	var arg=Motion._g_enter_leave_binder.find_object( this );
	if( arg!=null ) {
		if( event==null ) {
			event=window.event;
		}
		var to=document.body;
		if( event.relatedTarget ) {
			to=event.relatedTarget;
		}else if( event.passThroughRelatedTarget ) { // workaround for mozilla bug that spoils replay_event in run-tests.html
			to=event.passThroughRelatedTarget;
		}else if( event.toElement ) {
			to=event.toElement;
		}
		var target=this;
		if( event.target ) {
			target=event.target;
		}else if( event.srcElement ) {
			target=event.srcElement;
		}
		var internal=Motion._is_child_of( to, this ) && Motion._is_child_of( target, this );
		if( !internal ) {
			arg.leave_handler( this, arg.handler_arg );
		}
	}
}


/*
node: node for which to track mouse enver/leave
enter_handler, leave_hander: each takes two arguments: node and handler_arg
handler_arg: second argument to enter_handler, leave_handler
*/
Motion.track_enter_leave=function( arg )
{
	arg.node.onmouseover=Motion._on_mouseover;
	arg.node.onmouseout=Motion._on_mouseout;
	return Motion._g_enter_leave_binder.bind_object( arg.node, { enter_handler: arg.enter_handler, leave_handler: arg.leave_handler, handler_arg: arg.handler_arg } );
}
Motion.track_same_enter_leave=function( id, node )
{
	var object=Motion._g_enter_leave_binder.bind_same_object( id, node );
	if( object!=null ) {
		node.onmouseover=Motion._on_mouseover;
		node.onmouseout=Motion._on_mouseout;
		object=object.handler_arg;
	}
	return object;
}
Motion.cancel_enter_leave=function( node )
{
	var object=Motion._g_enter_leave_binder.unbind_object( node );
	if( object!=null ) {
		object=object.handler_arg;
	}
	return object;
}


// timeline

/*
handler: called when duration_seconds passes, if not canceled or reset
handler_arg: second argument to end_handler and progress_handler.
	first argument is Motion.Timeline object.
state: initial state. optional.
*/
Motion.Timeline=function( arg )
{
	this._state=arg.state;
	this._end_handler=arg.handler;
	this._handler_arg=arg.handler_arg;
}

/*
_active
_state
_start_time
_end_time
_end_handler : optional. does not fire on reset.
_progress_start
_progress_end
_progress_handler
_handler_arg
_progress_value
*/
Motion.Timeline._active_objects=[];
Motion.Timeline._timer_granularity=20; // in milliseconds

Motion.Timeline._timer=function()
{
	var cur_time=(new Date()).getTime();
	var i=0;
	while( i<Motion.Timeline._active_objects.length ) {
		var t=Motion.Timeline._active_objects[i];
		if( t._end_time!=0 ) { // it was not canceled
			if( t._end_time<cur_time ) { // it just ended
				t._end_time=0;
				if( t._progress_start!=null && t._progress_end!=null && t._progress_handler!=null ) { // call progress_handler with final value
					t._progress_value=t._progress_end;
					t._progress_handler( t, t._handler_arg );
				}
				if( t._end_handler ) {
					t._end_handler( t, t._handler_arg ); // might only modify existing and add new objects to active_objects
				}
			}else { // call progress_handler, if required
				if( t._progress_start!=null && t._progress_end!=null && t._progress_handler!=null ) {
					t._progress_value=t._progress_start+1.0*(t._progress_end-t._progress_start)*(cur_time-t._start_time)/(t._end_time-t._start_time);
					t._progress_handler( t, t._handler_arg );
				}
			}
		}
		++i;
	}
	var new_active_objects=[];
	i=0;
	while( i<Motion.Timeline._active_objects.length ) {
		var t=Motion.Timeline._active_objects[i];
		if( t._end_time==0 ) {
			t._active=false;
		}else {
			new_active_objects.push( t );
		}
		++i;
	}
	Motion.Timeline._active_objects=new_active_objects;
	if( new_active_objects.length>0 ) {
		setTimeout( Motion.Timeline._timer, Motion.Timeline._timer_granularity );
	}
}

/*
state: new state
duration_seconds: intended duration of that state
progress_start, progress_end, progress_handler: if not null, progress_handler is called periodically
	with t.progress_value() ranging from progress_start to progress_end
*/
Motion.Timeline.prototype.set=function( arg )
{
	this._state=arg.state;
	this._start_time=(new Date()).getTime();
	this._end_time=this._start_time+1000*arg.duration_seconds;
	this._progress_start=arg.progress_start;
	this._progress_end=arg.progress_end;
	this._progress_handler=arg.progress_handler;
	// add to active objects, if it's not already there
	var start_timer=false;
	if( !this._active ) {
		start_timer=Motion.Timeline._active_objects.length==0;
		this._active=true;
		Motion.Timeline._active_objects.push( this );
	}
	if( this._progress_start!=null && this._progress_end!=null && this._progress_handler!=null ) { // call progress_handler with initial value
		this._progress_value=this._progress_start;
		this._progress_handler( this, this._handler_arg );
	}
	// start the timer, if it was the first active object
	if( start_timer ) {
		setTimeout( Motion.Timeline._timer, Motion.Timeline._timer_granularity );
	}
}
Motion.Timeline.prototype.cancel=function( state )
{
	this._state=state;
	this._end_time=0;
}
Motion.Timeline.prototype.state=function()
{
	return this._state;
}
Motion.Timeline.prototype.seconds_passed=function()
{
	var cur_time=(new Date()).getTime();
	return (cur_time-this._start_time)/1000.0;
}
Motion.Timeline.prototype.progress_value=function()
{
	return this._progress_value;
}

// popup

// constants
Motion._g_popup_state_empty="."; // fill should be called
Motion._g_popup_state_invisible="0";
Motion._g_popup_state_delay_show="*";
Motion._g_popup_state_fade_in="+";
Motion._g_popup_state_visible="1";
Motion._g_popup_state_delay_hide="/";
Motion._g_popup_state_fade_out="-";

// default values
Motion._g_popup_defaults={
	fade_in_seconds:0.3,
	fade_out_seconds:0.3,
	delay_show_seconds:0.5,
	delay_hide_seconds:0.5,

	min_show_opacity:0.2,
	min_hide_opacity:0.4,
	max_opacity:0.87
};
// timeline object is the handler_arg for track_enter_leave.
// it has additional fields:
//	popup_filler, popup_filler_arg, popup_side, popup_side_align, popup_side_offset: carried from attach_popup arg
//	opacity: opacity of popup div, increased from 0 to 100 while the state is fade_in, decreased from 100 downto 0 while the state is fade_out.

// arg:
//	trigger_node: node mouseover over which triggers popup
//	anchor_node: node relative to which the popup is positioned, as specified by side, side_align, side_offset and anchor_offset. If anchor_node is null, it's assumed to be the same as trigger_node.
//	x_anchor_node, y_anchor_node: when popup is positioned relative to one node horizontally and to another node vertically.
//	anchor_offset: distance between anchor node and popup edges, in pixels.
//	side: "top", "bottom", "left" or "right" - popup will appear at that side of the node
//	side_align: "left" "top", "right" "bottom" - specify alignement with the node: when side is "top" or "bottom" - along x axis, when side is "left" or "right" - along with y axis
//	side_offset: offset, in pixels,  to the position given by side_align
//	border: border style for a popup, as string like "1px solid #000"
//	backgound_color: popup background color
//	popup_filler: function to fill and set additional styles for popup div
//	filler_arg: second argument for popup_filler (first is popup div)
//	transparent: alpha fade-in and fade-out effect, with the following parameters:
//	fade_in_seconds, fade_out_seconds, delay_show_seconds, delay_hide_seconds: delays
//	min_show_opacity, min_hide_opacity, max_opacity: fade-in from min_show_opacity to max opacity, fade-out from max opacity to min_hide_opacity
Motion.attach_popup=function( arg )
{
	var timeline=new Motion.Timeline( { state: Motion._g_popup_state_empty, handler: Motion._on_popup_timeline_end } );
	timeline.popup_anchor_offset=arg.anchor_offset;
	if( timeline.popup_anchor_offset==null ) {
		timeline.popup_anchor_offset=0;
	}
	timeline.popup_side=arg.side;
	if( timeline.popup_side==null ) {
		timeline.popup_side="top";
	}
	timeline.popup_side_align=arg.side_align;
	if( timeline.popup_side=="top" || timeline.popup_side=="bottom" ) {
		if( timeline.popup_side_align==null || (timeline.popup_side_align!="left" && timeline.popup_side_align!="right") ) {
			timeline.popup_side_align="left";
		}
	}
	if( timeline.popup_side=="left" || timeline.popup_side=="right" ) {
		if( timeline.popup_side_align==null || (timeline.popup_side_align!="top" && timeline.popup_side_align!="bottom") ) {
			timeline.popup_side_align="top";
		}
	}
	timeline.popup_side_offset=arg.side_offset;
	if( timeline.popup_side_offset==null ) {
		timeline.popup_side_offset=0;
	}
	for( var def in Motion._g_popup_defaults ) {
		timeline[def]=arg[def]!=null ? arg[def] : Motion._g_popup_defaults[def];
	}
	timeline.popup_filler=arg.popup_filler;
	timeline.popup_filler_arg=arg.filler_arg;
	timeline.popup_on_show=arg.on_show;
	timeline.popup_trigger=arg.trigger_node;
	timeline.popup_x_anchor=arg.x_anchor_node!=null ? arg.x_anchor_node : arg.anchor_node!=null ? arg.anchor_node : arg.trigger_node;
	timeline.popup_y_anchor=arg.y_anchor_node!=null ? arg.y_anchor_node : arg.anchor_node!=null ? arg.anchor_node : arg.trigger_node;
	timeline.popup_transparent=arg.transparent;
	timeline.popup_border=arg.border;
	timeline.popup_background_color=arg.background_color;
	timeline.popup_id=Motion.track_enter_leave( {
		node: arg.trigger_node, enter_handler: Motion._on_popup_enter, leave_handler: Motion._on_popup_leave, handler_arg: timeline
	} );
	return timeline.popup_id;
}
Motion.attach_same_popup=function( id, node )
{
	Motion.track_same_enter_leave( id, node );
}
Motion.detach_popup=function( node )
{
	var timeline=Motion.cancel_enter_leave( node );
	if( timeline!=null ) {
		var popup=timeline.popup;
		if( popup!=null ) {
			timeline.popup.parentNode.removeChild( timeline.popup );
			timeline.popup=null;
		}
		timeline.popup_filler_arg=null;
		timeline.cancel( null );
	}
}
Motion._on_popup_timeline_end=function( timeline )
{
	var state=timeline.state();
	if( state==Motion._g_popup_state_delay_show ) {
		if( timeline.popup_transparent ) {
			Motion._popup_setup_fade( timeline, timeline.max_opacity );
			Motion._popup_show( timeline );
		}else {
			Motion._popup_show( timeline );
			timeline.cancel( Motion._g_popup_state_visible );
		}
	}else if( state==Motion._g_popup_state_fade_in ) {
		timeline.cancel( Motion._g_popup_state_visible );
	}else if( state==Motion._g_popup_state_delay_hide ) {
		if( timeline.popup_transparent ) {
			Motion._popup_setup_fade( timeline, timeline.min_hide_opacity );
		}else {
			timeline.cancel( Motion._g_popup_state_invisible );
			Motion._popup_hide( timeline );
		}
	}else if( state==Motion._g_popup_state_fade_out ) {
		timeline.cancel( Motion._g_popup_state_invisible );
		Motion._popup_hide( timeline );
		timeline.opacity=timeline.min_show_opacity;
	}
}
Motion._on_popup_enter=function( node, timeline )
{
	Motion._popup_trigger_show( timeline );
}
Motion._on_popup_leave=function( node, timeline )
{
	Motion._popup_trigger_hide( timeline );
}
Motion._popup_trigger_show=function( timeline )
{
	var state=timeline.state();
	if( state==Motion._g_popup_state_empty ) {
		var popup=timeline.popup_trigger.ownerDocument.createElement( "DIV" );
		popup.style.visibility="hidden";
		popup.style.position="absolute";
		timeline.popup_trigger.ownerDocument.body.appendChild( popup );
		if( timeline.popup_border!=null ) {
			popup.style.borderTop=arg.border;
			popup.style.borderRight=arg.border;
			popup.style.borderBottom=arg.border;
			popup.style.borderLeft=arg.border;
		}
		if( timeline.popup_background_color!=null ) {
			popup.style.backgroundColor=arg.background_color; // defaulting to "#ffffe2" when arg.background_color is null turned out to be a disservice
		}
		popup.style.zIndex=1000;
		timeline.popup=popup;
		Motion.track_same_enter_leave( timeline.popup_id, popup );

		timeline.opacity=timeline.min_show_opacity;
		timeline.popup_filler( timeline.popup, timeline.popup_filler_arg );
		timeline.set( { state: Motion._g_popup_state_delay_show, duration_seconds: timeline.delay_show_seconds } );
	}else if( state==Motion._g_popup_state_invisible ) {
		// XXX handle filler taking longer time to complete than Motion._g_popup_delay_seconds
		timeline.set( { state: Motion._g_popup_state_delay_show, duration_seconds: timeline.delay_show_seconds } );
	}else if( state==Motion._g_popup_state_delay_hide ) {
		if( timeline.opacity==timeline.max_opacity ) {
			timeline.cancel( Motion._g_popup_state_visible );
		}else {
			Motion._popup_setup_fade( timeline, timeline.max_opacity );
		}
	}else if( state==Motion._g_popup_state_fade_out ) {
		timeline.set( { state: Motion._g_popup_state_delay_show, duration_seconds: timeline.delay_show_seconds } );
	}
}
Motion._popup_trigger_hide=function( timeline )
{
	var state=timeline.state();
	if( state==Motion._g_popup_state_delay_show ) {
		if( timeline.opacity==timeline.min_hide_opacity ) {
			timeline.cancel( Motion._g_popup_state_invisible );
		}else {
			Motion._popup_setup_fade( timeline, timeline.min_hide_opacity );
		}
	}else if( state==Motion._g_popup_state_fade_in ) {
		timeline.set( { state: Motion._g_popup_state_delay_hide, duration_seconds: timeline.delay_hide_seconds } );
	}else if( state==Motion._g_popup_state_visible ) {
		timeline.set( { state: Motion._g_popup_state_delay_hide, duration_seconds: timeline.delay_hide_seconds } );
	}
}
Motion._popup_setup_fade=function( timeline, resulting_opacity )
{
	var new_state;
	var fade_seconds;
	var start_opacity;
	var end_opacity;
	if( resulting_opacity==timeline.min_hide_opacity ) {
		new_state=Motion._g_popup_state_fade_out;
		fade_seconds=timeline.fade_out_seconds*Math.max( 0, timeline.opacity-timeline.min_hide_opacity);
		start_opacity=timeline.opacity;
		end_opacity=timeline.min_hide_opacity;
	}else if( resulting_opacity==timeline.max_opacity ) {
		new_state=Motion._g_popup_state_fade_in;
		fade_seconds=timeline.fade_in_seconds*Math.max(0, timeline.max_opacity-timeline.opacity);
		start_opacity=timeline.opacity;
		end_opacity=timeline.max_opacity;
	}
	timeline.set( { state: new_state, duration_seconds: fade_seconds, progress_start: start_opacity, progress_end: end_opacity, progress_handler: Motion._popup_fade_progress } );
}
Motion._set_element_opacity=function( element, op )
{
	if( op==null ) {
		element.style.opacity="";
		element.style.filter="";
	}else {
		if( op>0.9995 ) { // setting opacity to exact 1 causes popup to flicker in mozilla
			op=0.9995;
		}
		element.style.opacity=op;
		element.style.filter="alpha(opacity:"+100*op+")";
	}
}
Motion._popup_fade_progress=function( timeline )
{
	timeline.opacity=timeline.progress_value();
	if( timeline.popup_transparent && timeline.popup.style.display!="none" && timeline.popup.style.visibility!="hidden" ) {
		Motion._set_element_opacity( timeline.popup, timeline.opacity );
	}
}
Motion._get_window_size=function( elm )
{
	var doc=elm.ownerDocument;
	var size={ x: 0, y: 0 };
	if( self.innerWidth ) {
		size.x=self.innerWidth;
		size.y=self.innerHeight;
	}else if( doc.documentElement && doc.documentElement.clientWidth ) {
		size.x=doc.documentElement.clientWidth;
		size.y=doc.documentElement.clientHeight;
	}else if( doc.body )	{
		size.x=doc.body.clientWidth;
		size.y=doc.body.clientHeight;
	}
	return size;
}
Motion._popup_show=function( timeline )
{
	var popup=timeline.popup;
	var x_anchor=timeline.popup_x_anchor;
	var y_anchor=timeline.popup_y_anchor;
	var anchor_pos={ x: Motion.get_page_coords( x_anchor ).x, y: Motion.get_page_coords( y_anchor ).y };
	var window_size=Motion._get_window_size( popup );

	var popup_x;
	var popup_y;

	var popup_left_side=anchor_pos.x-timeline.popup_anchor_offset-popup.clientWidth;
	var popup_right_side=anchor_pos.x+x_anchor.clientWidth+timeline.popup_anchor_offset;
	var popup_top_side=anchor_pos.y-timeline.popup_anchor_offset-popup.clientHeight;
	var popup_bottom_side=anchor_pos.y+y_anchor.clientHeight+timeline.popup_anchor_offset;
	if( timeline.popup_side=="left" ) {
		popup_x=popup_left_side>=0 ? popup_left_side : popup_right_side;
	}else if( timeline.popup_side=="right" ) {
		popup_x=popup_right_side<window_size.x-popup.clientWidth ? popup_right_side : popup_left_side;
	}else if( timeline.popup_side=="top" ) {
		popup_y=popup_top_side>=0 ? popup_top_side : popup_bottom_side;
	}else if( timeline.popup_side=="bottom" ) {
		popup_y=popup_bottom_side<window_size.y-popup.clientHeight ? popup_bottom_side : popup_top_side;
	}

	if( timeline.popup_side_align=="left" ) {
		popup_x=anchor_pos.x+timeline.popup_side_offset;
	}else if( timeline.popup_side_align=="right" ) {
		popup_x=anchor_pos.x+x_anchor.clientWidth-popup.clientWidth+timeline.popup_side_offset;
	}else if( timeline.popup_side_align=="top" ) {
		popup_y=anchor_pos.y+timeline.popup_side_offset;
	}else if( timeline.popup_side_align=="bottom" ) {
		popup_y=anchor_pos.y+y_anchor.clientHeight-popup.clientHeight+timeline.popup_side_offset;
	}

	if( popup_y+timeline.popup.clientHeight>window_size.y ) {
		popup.style.height=(window_size.y-popup_y-20)+"px";
		popup.style.width=(popup.clientWidth+20)+"px"; // allow for vertical scroll bar
		popup.style.overflow="auto";
	}
	Motion.set_page_coords( popup, popup_x, popup_y );

	if( timeline.popup_on_show!=null ) {
		timeline.popup_on_show( timeline.popup );
	}

	if( timeline.popup_transparent ) {
		Motion._set_element_opacity( popup, timeline.opacity );
	}
	popup.style.visibility="visible";
}
Motion._popup_hide=function( timeline )
{
	timeline.popup.style.visibility="hidden";
	if( timeline.popup_transparent ) {
		Motion._set_element_opacity( timeline.popup, null ); // otherwize, with semi-transparent invisible popups, it gets so slow...
	}
	// and setting 'display' to 'none' is ruled out since popup placement in _popup_show relies upon popup clientWidth.
}

// track_drag

//Motion._tracked_drag_nodes=[];
//Motion._tracked_drag_generation_counter=0;
Motion._g_drag_binder=new Motion.ObjectBinder( "drag" );
Motion._tracked_dragging_element=null;
/*
node: node for which to track mouse drag
handler_arg: second argument to down_handler, up_handler, move_handler
down_handler: takes two arguments: node and handler_arg
move_handler: takes four arguments: node, handler_arg, offset, first (offset: { x: x, y: y }, first - boolean, true for the first move_handler call after down_handler call)
up_handler: takes three arguments: node, handler_arg, offset
*/
Motion.track_drag=function( arg )
{
	var attach_body_handlers= Motion._g_drag_binder.m_objects.length==0; // this array never shrinks, so it will be true one time only
	if( attach_body_handlers ) {
		var body=arg.node.ownerDocument.body;
		if( body.addEventListener!=null ) {
			body.addEventListener( "mousedown", Motion._track_drag_on_mousedown, false );
			body.addEventListener( "mouseup", Motion._track_drag_on_mouseup, false );
			body.addEventListener( "mousemove", Motion._track_drag_on_mousemove, false );
		}else if( body.attachEvent!=null ) {
			document.attachEvent( "onmousedown", Motion._track_drag_on_mousedown );
			document.attachEvent( "onmouseup", Motion._track_drag_on_mouseup );
			document.attachEvent( "onmousemove", Motion._track_drag_on_mousemove );
		}else {
			// out of luck
		}
	}
	return Motion._g_drag_binder.bind_object( arg.node, { down_handler: arg.down_handler, up_handler: arg.up_handler, move_handler: arg.move_handler,
		handler_arg: arg.handler_arg } );
}
Motion.cancel_drag=function( node )
{
	var object=Motion._g_drag_binder.unbind_object( node );
	if( object!=null ) {
		object=object.handler_arg;
	}
	return object;
}
Motion.get_event_coords=function( e )
{
	if( e.pageX!=null && e.pageY!=null ) {
		return { x: e.pageX, y: e.pageY };
	}else if( e.clientX!=null && e.clientY!=null ) {
		return { x: e.clientX+document.body.scrollLeft, y: e.clientY+document.body.scrollTop };
	}
	return null;
}
Motion._track_drag_on_mousedown=function( e )
{
	if( Motion._tracked_dragging_element==null ) {
		if( e==null ) {
			e=window.event;
		}
		var elm= e.target!=null ? e.target : e.srcElement;
		var arg;
		while( elm!=null ) {
			var arg=Motion._g_drag_binder.find_object( elm );
			if( arg!=null ) {
				break;
			}
			elm=elm.parentNode;
		}
		if( elm!=null && arg!=null ) {
			arg.dragging_starting_point=Motion.get_event_coords( e );
			arg.dragging_first_move=true;
			if( arg.dragging_starting_point!=null ) {
				Motion._tracked_dragging_element=elm;
				if( arg.down_handler!=null ) {
					arg.down_handler( elm, arg.handler_arg );
				}
			}
		}
	}else {
		Motion._tracked_dragging_element=null;
	}
}
Motion._track_drag_on_mouseup=function( e )
{
	if( e==null ) {
		e=window.event;
	}
	if( Motion._tracked_dragging_element!=null ) {
		var arg=Motion._g_drag_binder.find_object( Motion._tracked_dragging_element );
		if( arg!=null && arg.up_handler!=null ) {
			var pt=Motion.get_event_coords( e );
			if( pt!=null && arg.dragging_starting_point!=null ) {
				pt.x-=arg.dragging_starting_point.x;
				pt.y-=arg.dragging_starting_point.y;
			}
			arg.up_handler( Motion._tracked_dragging_element, arg.handler_arg, pt );
		}
		Motion._tracked_dragging_element=null;
	}
}
Motion._track_drag_on_mousemove=function( e )
{
	if( e==null ) {
		e=window.event;
	}
	if( Motion._tracked_dragging_element!=null ) {
		var arg=Motion._g_drag_binder.find_object( Motion._tracked_dragging_element );
		if( arg!=null ) {
			if( arg.move_handler!=null ) {
				var pt=Motion.get_event_coords( e );
				if( pt!=null && arg.dragging_starting_point!=null ) {
					pt.x-=arg.dragging_starting_point.x;
					pt.y-=arg.dragging_starting_point.y;
				}
				arg.move_handler( Motion._tracked_dragging_element, arg.handler_arg, pt, arg.dragging_first_move );
			}
			arg.dragging_first_move=false;
		}
	}
}

/*
direction: "h" or "v"
container: HTML element to split
contents1, contents2: arrays of HTML elements that will be put inside each half of the container (both may be null)
initial_split: number in the range from 0 to 1, specifying half1 initial size in proportion to the container. defaults to 0.5
resize_handler: called each time splitter is dragged
resize_handler_arg: second argument for resize_handler
returns an object with three created HTML elements: { splitter, half1, half2 }
*/
Motion._g_splitter_size=3;
Motion._g_splitter_margin=4;
Motion._g_half_margin=3;
Motion._g_min_half_size=10;
Motion._g_window_resize_attached=false;
Motion.make_splitter=function( arg )
{
	var doc=arg.container.ownerDocument;
	var half1=arg.container.appendChild( doc.createElement( "DIV" ) );
	var splitter=arg.container.appendChild( doc.createElement( "DIV" ) );
	var half2=arg.container.appendChild( doc.createElement( "DIV" ) );
	if( arg.contents1!=null ) {
		for( var i=0; i<arg.contents1.length; ++i ) {
			Motion._reparent_node( arg.contents1[i], half1 );
		}
	}
	if( arg.contents2!=null ) {
		for( var i=0; i<arg.contents2.length; ++i ) {
			Motion._reparent_node( arg.contents2[i], half2 );
		}
	}
	var result={ splitter: splitter, half1: half1, half2: half2 };
	var to_zero=[ "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "marginTop", "marginRight", "marginBottom", "marginLeft" ];
	var result_i;
	var to_zero_i;
	for( result_i in result ) {
		for( to_zero_i=0; to_zero_i<to_zero.length; ++to_zero_i ) {
			result[result_i][to_zero[to_zero_i]]="0";
		}
	}
	half1.style.position="absolute";
	half2.style.position="absolute";
	splitter.style.position="absolute";
	var h=arg.direction.charAt( 0 )=="h";
	if( h ) {
		splitter.style.height=Motion._g_splitter_size+"px";
		splitter.style.width=(arg.container.clientWidth-2*Motion._g_splitter_margin)+"px";
	}else {
		splitter.style.height=(arg.container.clientHeight-2*Motion._g_splitter_margin)+"px";
		splitter.style.width=Motion._g_splitter_size+"px";
	}
	splitter.style.fontSize="1pt";
	splitter.style[ h ? "borderTop" : "borderLeft"]="1px solid #442";
	splitter.style[ h ? "borderBottom" : "borderRight"]="1px solid #442";
	splitter.style.backgroundColor="scrollbar";
	splitter.style.cursor= h ? "row-resize" : "col-resize";
	splitter.style.cursor= h ? "n-resize" : "w-resize";
	var initial_split= arg.initial_split==null ? 0.5 : arg.initial_split;
	var full_size= h ? arg.container.clientHeight : arg.container.clientWidth;
	full_size-=Motion._g_splitter_size-2;
	if( (h && window.opera!=null) || (!h && window.opera==null) ) {
		full_size-=4; // fudge
	}
	var handler_arg={
		h: h,
		container: arg.container,
		splitter: splitter,
		half1: half1,
		half2: half2,
		half1_size: Math.floor( initial_split*full_size ),
		half2_size: Math.floor( (1-initial_split)*full_size ),
		contents1: arg.contents1,
		contents2: arg.contents2,
		resize_handler: arg.resize_handler,
		resize_handler_arg: arg.resize_handler_arg,
		move_handler: arg.move_handler,
		container_pos: Motion.get_page_coords( arg.container ),
		container_size: { x: arg.container.clientWidth, y: arg.container.clientHeight }
	};
	Motion._splitter_set_sizes( handler_arg );
	Motion._splitter_handle_resize( handler_arg );
	Motion.track_drag( { node: splitter, down_handler: Motion._splitter_down_handler, up_handler: Motion._splitter_up_handler, move_handler: Motion._splitter_move_handler,
		handler_arg: handler_arg
	} );
	if( !Motion._g_window_resize_attached ) {
		Motion._g_window_resize_attached=true;
		var span=doc.createElement( "SPAN" );
		span.innerHTML="<!--[if IE]><br/><![endif]-"+"->";
		var is_ie=span.getElementsByTagName( "BR" ).length>0;
		if( !is_ie ) { // IE spuriously calls onresize, and body size appears to be changing, when e.g. popup div is displayed.
			if( window.addEventListener!=null ) {
				window.addEventListener( "resize", Motion._splitter_on_window_resize, false );
			}else if( window.attachEvent!=null ) {
				window.attachEvent( "onresize", Motion._splitter_on_window_resize );
			}else {
				// be nice to other scripts
			}
		}
	}
	return result;
}
Motion._reparent_node=function( node, new_parent )
{
	if( node.parentNode!=null ) {
		node.parentNode.removeChild( node );
	}
	new_parent.appendChild( node );
}
Motion._splitter_set_sizes=function( arg )
{
	if( arg.h ) {
		arg.half1_pos={ x: arg.container_pos.x+Motion._g_half_margin, y: arg.container_pos.y+Motion._g_half_margin };
		arg.half1_wh={ x: arg.container_size.x-2*Motion._g_half_margin, y: arg.half1_size-2*Motion._g_half_margin-2 };
		arg.half2_pos={ x: arg.container_pos.x+Motion._g_half_margin, y: arg.container_pos.y+arg.half1_size+(Motion._g_splitter_size+2)+Motion._g_half_margin };
		arg.half2_wh={ x: arg.container_size.x-2*Motion._g_half_margin, y: arg.half2_size-2*Motion._g_half_margin-2 };
		arg.splitter_pos={ x: arg.container_pos.x+Motion._g_splitter_margin, y: arg.container_pos.y+arg.half1_size };
	}else {
		arg.half1_pos={ x: arg.container_pos.x+Motion._g_half_margin, y: arg.container_pos.y+Motion._g_half_margin };
		arg.half1_wh={ x: arg.half1_size-2*Motion._g_half_margin-2, y: arg.container_size.y-2*Motion._g_half_margin };
		arg.half2_pos={ x: arg.container_pos.x+arg.half1_size+(Motion._g_splitter_size+2)+Motion._g_half_margin, y: arg.container_pos.y+Motion._g_half_margin };
		arg.half2_wh={ x: arg.half2_size-2*Motion._g_half_margin-2, y: arg.container_size.y-2*Motion._g_half_margin-2 };
		arg.splitter_pos={ x: arg.container_pos.x+arg.half1_size, y: arg.container_pos.y+Motion._g_splitter_margin };
	}
	arg.half1.style.width=arg.half1_wh.x+"px";
	arg.half1.style.height=arg.half1_wh.y+"px";
	Motion.set_page_coords( arg.half1, arg.half1_pos.x, arg.half1_pos.y );
	arg.half2.style.width=arg.half2_wh.x+"px";
	arg.half2.style.height=arg.half2_wh.y+"px";
	Motion.set_page_coords( arg.half2, arg.half2_pos.x, arg.half2_pos.y );
	Motion.set_page_coords( arg.splitter, arg.splitter_pos.x, arg.splitter_pos.y );
}
Motion._splitter_handle_resize=function( arg )
{
	if( arg.contents1!=null && arg.contents1.length==1 ) {
		arg.contents1[0].style.width=arg.half1.clientWidth+"px";
		arg.contents1[0].style.height=arg.half1.clientHeight+"px";
	}
	if( arg.contents2!=null && arg.contents1.length==1 ) {
		arg.contents2[0].style.width=arg.half2.clientWidth+"px";
		arg.contents2[0].style.height=arg.half2.clientHeight+"px";
	}
	if( arg.resize_handler!=null ) {
		arg.resize_handler( arg, arg.resize_handler_arg );
	}
}
Motion._splitter_down_handler=function( splitter, arg )
{
	// restore visibility if up handler was missed (by IE when mouseup occurs when cursor is ouside body)
	if( arg.hidden_nodes!=null ) {
		Motion._splitter_up_handler( splitter, arg, { x: 0, y: 0 } );
	}
	arg.half1_start_size=arg.half1_size;
	arg.half2_start_size=arg.half2_size;
}
Motion._splitter_move_handler=function( splitter, arg, offset, first )
{
	if( arg.move_handler!=null ) {
		arg.move_handler( arg, offset, first );
	}
	if( first ) {
		arg.hidden_nodes=[];
		arg.hidden_displays=[];
		var cn;
		for( cn=arg.half1.firstChild; cn!=null; cn=cn.nextSibling ) {
			arg.hidden_nodes.push( cn );
			arg.hidden_displays.push( cn.style.display );
			cn.style.display="none";
		}
		for( cn=arg.half2.firstChild; cn!=null; cn=cn.nextSibling ) {
			arg.hidden_nodes.push( cn );
			arg.hidden_displays.push( cn.style.display );
			cn.style.display="none";
		}
		arg.half1.style.border="1px dotted #777";
		arg.half2.style.border="1px dotted #777";
		arg.container_pos=Motion.get_page_coords( arg.container );
		arg.container_size={ x: arg.container.clientWidth, y: arg.container.clientHeight };
	}
	var new_half1_size=arg.half1_start_size+(arg.h ? offset.y : offset.x);
	var new_half2_size=arg.half2_start_size-(arg.h ? offset.y : offset.x);
	if( new_half1_size>Motion._g_min_half_size && new_half2_size>Motion._g_min_half_size ) {
		arg.half1_size=new_half1_size;
		arg.half2_size=new_half2_size;
	}
	Motion._splitter_set_sizes( arg );
}
Motion._splitter_up_handler=function( splitter, arg, offset )
{
	var i;
	for( i=0; i<arg.hidden_nodes.length; ++i ) {
		var display=arg.hidden_displays[i];
		arg.hidden_nodes[i].style.display= display==null ? "" : display;
	}
	arg.hidden_nodes=[];
	arg.hidden_displays=[];
	arg.half1.style.border="";
	arg.half2.style.border="";
	Motion._splitter_handle_resize( arg );
}
Motion._splitter_on_window_resize=function()
{
	for( var i=0; i<Motion._g_drag_binder.m_objects.length; ++i ) {
		var data=Motion._g_drag_binder.m_objects[i];
		if( data!=null && data.generation!=null ) {
			var generation=data.generation;
			data=data.object;
			if( data!=null && data.handler_arg!=null && data.handler_arg.splitter!=null && data.handler_arg.splitter.parentNode!=null
			  && data.handler_arg.splitter[Motion._g_drag_binder.m_generation_property]==generation
			  && data.handler_arg.splitter[Motion._g_drag_binder.m_id_property]==i ) {
				var arg=data.handler_arg;
				var new_container_pos=Motion.get_page_coords( arg.container );
				var new_container_size={ x: arg.container.clientWidth, y: arg.container.clientHeight };
				if( arg.container_pos==null || arg.container_pos.x!=new_container_pos.x || arg.container_pos.y!=new_container_pos.y
				  || arg.container_size==null || arg.container_size.x!=new_container_size.x || arg.container_size.y!=new_container_size.y ) {
					var prev_full_size=arg.h ? arg.container_size.y : arg.container_size.x;
					var new_full_size=arg.h ? new_container_size.y : new_container_size.x;
					new_full_size-=Motion._g_splitter_size-2;
					if( (arg.h && window.opera!=null) || (!arg.h && window.opera==null) ) {
						new_full_size-=4; // fudge
					}
					arg.half1_size=arg.half1_size*new_full_size/prev_full_size;
					arg.half2_size=new_full_size-arg.half1_size;
					arg.container_size=new_container_size;
					arg.container_pos=new_container_pos;
					Motion._splitter_set_sizes( arg );
					Motion._splitter_handle_resize( arg );
				}
			}
		}
	}
}

// track_scroll
Motion._g_scroll_binder=null;
Motion._g_scrolling_any=false;
Motion._g_track_scroll_delay=350;

// { node: handler: handler_arg }
Motion.track_scroll=function( arg )
{
	var first=false;
	if( Motion._g_scroll_binder==null ) {
		first=true;
		Motion._g_scroll_binder=new Motion.ObjectBinder( "scroll" );
	}
	Motion._g_scroll_binder.bind_object( arg.node, { node: arg.node, handler: arg.handler, handler_arg: arg.handler_arg, scrolling: false } );
	if( window.opera ) {
		if( first ) {
			window.setInterval( Motion._track_scroll_interval, 100 );
		}
	}else {
		arg.node.onscroll=Motion._on_scroll;
	}

}
Motion.cancel_scroll=function( node )
{
	var object=Motion._g_scroll_binder.unbind_object( node );
	if( object!=null ) {
		object=object.handler_arg;
	}
	return object;
}
Motion._track_scroll_timer=function()
{
	var any=false;
	var t=(new Date()).getTime();
	for( var i=0; i<Motion._g_scroll_binder.m_objects.length; ++i ) {
		var data=Motion._g_scroll_binder.m_objects[i];
		if( data!=null ) {
			data=data.object;
			if( data.scrolling && data.last_scroll_time!=null ) {
				if( t-data.last_scroll_time>Motion._g_track_scroll_delay ) {
					data.scrolling=false;
					if( data.handler ) {
						data.handler( data.handler_arg );
					}
				}else {
					any=true;
				}
			}
		}
	}
	if( any ) {
		setTimeout( Motion._track_scroll_timer, 100 );
	}
	Motion._g_scrolling_any=any;
}
Motion._on_scroll_one=function( data )
{
	if( data!=null ) {
		data.scrolling=true;
		data.last_scroll_time=(new Date()).getTime();
		if( !Motion._g_scrolling_any ) {
			Motion._g_scrolling_any=true;
			setTimeout( Motion._track_scroll_timer, 100 );
		}
	}
}
Motion._on_scroll=function()
{
	Motion._on_scroll_one( Motion._g_scroll_binder.find_object( this ) );
}
Motion._track_scroll_interval=function()
{
	for( var i=0; i<Motion._g_scroll_binder.m_objects.length; ++i ) {
		var data=Motion._g_scroll_binder.m_objects[i];
		if( data!=null ) {
			data=data.object;
			if( data.last_scroll_pos==null || data.last_scroll_pos!=data.node.scrollTop ) {
				data.last_scroll_pos=data.node.scrollTop;
				Motion._on_scroll_one( data );
			}
		}
	}
}

