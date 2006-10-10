/*
Copyright (C) 2005, Artem Khodush <greenkaa@gmail.com>

This file is licensed under the GNU General Public License version 2.
*/

if( typeof( Motion )=="undefined" ) {
	alert( "javascript file is omitted (Motion.js) - this page will not work properly" );
}

if( typeof( GitDiagram )=="undefined" ) {
/* arg:
	container_element: diagram_div
	style: "by-date" or "by-commit"
	ui_handler: function( ui_handler_arg, event_name, rest of event args )
	ui_handler_arg: first argument to ui_handler
		ui events with their arguments are:
						"draw"	diagram "begin"|"end"
						"place"	diagram "begin"|"end"
						"node_init"	diagram node node_div
*/
GitDiagram=function( arg )
{
	this.m_container_element=arg.container_element;
	this.m_style=arg.style;
	if( arg.ui_handler==null ) {
		this.m_ui_handler=function() {};
	}else {
		this.m_ui_handler=arg.ui_handler;
	}
	this.m_ui_handler_arg=arg.ui_handler_arg;
	this.m_diagram_id=++GitDiagram._g_diagram_id_counter; // for assigning unique ids to subelements
	this.m_background_htm=""; // date columns with dates and month names. The distinction between m_background_htm and m_diagram_htm is historical.
	this.m_diagram_htm=""; // everything else
	if( typeof( jsGraphics )!="undefined" ) {
		this.m_jsg=new jsGraphics( "random" ); // use this nice 2D rasterizer into DIVs - for drawing slant lines and arrows
		this.m_jsg.cnv=this.m_container_element; // force it to accept real element instead of id
	}
	this.m_window_offset={ x: 0, y: 0 }; // in pixels
	//large
	this.m_pixels_per_unit=22; // scale for absolute units: distance between two adjacent trunk (horizontal) lines on the diagram.
	// small
//		this.m_pixels_per_unit=8; // scale for absolute units: distance between two adjacent trunk (horizontal) lines on the diagram.

	this.m_nodes={}; /* hash: SHA1 id -> object
	initialized in add_node
		repos: array of repositories this node belongs to.
		committer_time, author_time: javascriptish time_t
		time: javascriptish time_t, adjusted so that no (child) node has a date earlier than the date of its parent[0]
		date: javascriptish time_t, == time without time part (date only)
		author: as in commit
		comment: as in commit
		parents: array of nodes. add_node creates nodes in m_nodes with date==null for parents.
		children: array of nodes.  elements are added to parent node's children arrays by add_node.
		date_column: reference to appropriate element of m_date_columns. assigned by propagate_date_time. gives node absolute_x as date_column.absolute_x+node.offset_x.
	assigned later
		offset_y: offset relative to parent[0]. assigned by _place_node_subtree.
		absolute_y: absolute y coordinate, increases downwards (1 equals to conventional distance between two adjacent lines). assigned by _propagate_absolute_y_offset_x
		offset_x: horizontal offset relative to the start of the date column, in the same units as offset_y and absolute_y, assigned by _propagate_absolute_y_offset_x
		line_rightmost_node - rightmost node on the horizontal line starting from this node, or null if the node is not at the beginning of a line, assigned by _place_node_subtree
		coalesced_nodes - array of child nodes placed at the same point with the node (having the same date and offset_x with the node)
		coalesced_to - when not null, the node is in the coalesced_nodes array of coalesced_to, hence is not drawn
		popup_id - kept so that for coalesced nodes, multiple node divs (bullets) have the same popup assigned
	used only in by-commit drawing
		line_leftmost_node - first node on the line that goes through this node
		*/
	this.m_labels={}; /* hash: SHA1 id -> object, added by add_label
		tags: array of { repo: repo_name, name: label name (tags) } assigned to the id
		absolute_pos: { x, y }, used by  assign_offset_x to ensure that label divs do not overlap
	*/
	this.m_date_columns=[]; /* array of { date, width, absolute_x, lines, node }, sorted by date.
		elements of m_date_columns are inserted by add_node as needed, with date and width initialized with node date and 0.
		each element width is determined by _propagate_absolute_y_offset_x
		each element absolute_x is assigned as sum of previous columns widths at the end of place_nodes.
		lines - array of objects describing trunk and merge lines that go through that column
		(assigned and used only in by-commit placement and drawing) {
			start_node: leftmost node on the line
		}
		node - the node in this column (placement routines ensure that there is only one node in each column)
		short_merge - the node in this column is merged with node from the previous column
	*/
	this.m_start_more_ids=[]; /* ids and repos of nodes that were encountered as parents of added nodes,  but were never added themselves.
		serve as starting point for loading more commits.
	*/
	this.m_repos=[]; /* distinct repositories from which nodes and labels were added
	*/
	// used in drawing
	this.m_container_origin={ x: 0, y: 0 };
	// used to keep the position of the first column the same after loading more commits
	this.m_prev_first_column=null;
	// if someone wants to see the status..
	this.m_node_count=0;
	// running index to assing different colors to branch lines (done only in by-commit placement)
	this.m_line_color_index=0;
	// to keep colors assigned for particular branches and assign the same colors to same branches again after load_more
	this.m_assigned_colors={}; // rightmost node id => color
	
	// in  firefox, if diagram div in by-commit.html obscures log table, it steals mouse events, and log table rows become non-clickable.
	// contract diagram div to some minimum width, and preserve original width for use in clipping etc.
	this.m_container_width=this.m_container_element.clientWidth;
	if( this.m_style=="by-commit" ) {
		this.m_container_element.style.width=1+"px";
	}
}
}
GitDiagram._g_diagram_id_counter=0;
GitDiagram.prototype.add_node=function( id, committer_time, author_time, author, comment, parent_ids, repo )
{
	GitDiagram._add_repo( this.m_repos, repo );
	var node=this.m_nodes[id];
	if( node==null ) {
		node={ id: id, committer_time: committer_time, author_time: author_time, author: author, comment: comment, parents: [], children: [], repos: [repo] };
		this.m_nodes[id]=node;
	}else if( node.author!=null ) { // it's already here, but may arrive from other repo as well (it must be identical in every repo, due to SHA...)
		GitDiagram._add_repo( node.repos, repo );
		return;
	}else { // it was a stub, created as some other node's parent
		GitDiagram._add_repo( node.repos, repo );
		node.committer_time=committer_time;
		node.author_time=author_time;
		node.author=author;
		node.comment=comment;
	}
	var parent;
	for( var parent_i=0; parent_i!=parent_ids.length; ++parent_i ) {
		parent=this.m_nodes[parent_ids[parent_i]];
		if( parent==null ) {
			parent={ id: parent_ids[parent_i], parents: [], children: [], repos: [repo] };
			this.m_nodes[parent_ids[parent_i]]=parent;
		}
		node.parents.push( parent );
		parent.children.push( node );
	}
}
GitDiagram.prototype.add_label=function( id, label, repo, type )
{
	if( this.m_labels[id]==null ) {
		this.m_labels[id]={ tags: [] };
	}
	this.m_labels[id].tags.push( { repo: repo, name: label, type: type } );
	GitDiagram._add_repo( this.m_repos, repo );
}
GitDiagram.prototype._assign_date=function( node )
{
	if( this.m_style=="by-commit" ) {
		node.date=node.time;
	}else {
		var dt=new Date( node.time );
		var y=dt.getFullYear();
		var m=dt.getMonth();
		var d=dt.getDate();
		node.date=(new Date( y, m, d, 0, 0, 0, 0 )).getTime();
	}
	node.date_column=GitDiagram._insert_date_column( this.m_date_columns, node.date, this.m_style );
	if( this.m_style=="by-commit" ) {
		node.date_column.node=node;
	}
}
GitDiagram.prototype._check_date_time=function( node, parent_time )
{
	// check and assign time (push children into the future if necessary)
	node.time=node.author_time;
	if( node.time==null || node.time<=parent_time ) {
		node.time=node.committer_time;
	}
	if( node.time<=parent_time ) {
		node.time=parent_time+1;
	}
	this._assign_date( node );
}
GitDiagram.prototype._propagate_date_time=function( start_node )
{
	// make sure that time order does not contradict to parent-child order
	// for now, this matters only for primary parents
	var nodes=[start_node];
	while( nodes.length>0 ) {
		var current_node=nodes[0];
		nodes.splice( 0, 1 );
		var primary_children=GitDiagram._get_node_primary_children( current_node );
		for( var child_i=0; child_i<primary_children.length; ++child_i ) {
			var child=primary_children[child_i];
			this._check_date_time( child, current_node.time );
			nodes.push( child );
		}
	}
}
GitDiagram.prototype.place_nodes=function( keep_window_offset )
{
	this.m_ui_handler( this.m_ui_handler_arg, "place", this, "begin" );
	this._reset_placement_data();
	// node for selecting best window offset value
	var rightmost_leaf=null;
	var last_y;
	var bottom_shape;
	this.m_start_more_ids=[];
	var node_count=0;
	// since placement depends on date and date_column, two passes are needed
	// first, assign nodes to date_columns
	for( var node_id in this.m_nodes ) {
		var node=this.m_nodes[node_id];
		if( node.author!=null ) {
			if( node.parents[0]==null || node.parents[0].author==null ) {
				node.time=node.author_time;
				if( node.time==null ) {
					node.time=node.committer_time;
				}
				this._assign_date( node );
				this._propagate_date_time( node );
			}
		}else {
			this.m_start_more_ids.push( { id: node.id, repos: node.repos } );
		}
		++node_count;
	}
	this.m_node_count=node_count;
	// then. loop for each node and call _place_node_subtree for each root node
	for( var node_id in this.m_nodes ) {
		var node=this.m_nodes[node_id];
		if( node.author!=null ) {
			if( node.parents[0]==null || node.parents[0].author==null ) {
				var node_shapes=this._place_node_subtree( node, { date: node.date, offset: 0 } );
				if( last_y==null ) {
					last_y=0;
					bottom_shape=node_shapes[1];
				}else {
					last_y=GitDiagram._determine_branch_offset( last_y, 1, node_shapes[-1], bottom_shape );
					bottom_shape=GitDiagram._expand_shape( last_y, node_shapes[1], bottom_shape );
				}
				node.absolute_y=last_y;
				node.offset_x=GitDiagram._g_step_x[this.m_style]/2;
				this._propagate_absolute_y_offset_x( node );
				if( node.line_rightmost_node!=null ) {
					var leaf=node.line_rightmost_node;
					if( rightmost_leaf==null
					  || leaf.date>rightmost_leaf.date
					  || (leaf.date==rightmost_leaf.date && leaf.offset_x>rightmost_leaf.offset_x) ) {
						rightmost_leaf=leaf;
					}
				}
			}
		}
	}
	// set absolute_x for date_columns
	var current_x=0;
	for( var date_column_i=0; date_column_i<this.m_date_columns.length; ++date_column_i ) {
		var date_column=this.m_date_columns[date_column_i];
 		date_column.absolute_x=current_x;
		current_x+=date_column.width;
	}
	if( this.m_style=="by-date" ) { // for by-commit, window_offset is pegged to the log table scrollTop
		// another nodes that affect best window offset value
		var master=null;
		var rightmost_label=null;
		for( var label_i in this.m_labels ) {
			var label_node=this.m_nodes[label_i];
			if( label_node!=null ) {
				if( label_node.children.length==0 ) { // somewhat arbitrary condition
					if( GitDiagram._is_label_master( this.m_labels[label_i] )  ) {
						master=label_node;
					}else if( rightmost_label==null
						 || label_node.date>rightmost_label.date
						 || (label_node.date==rightmost_label.date && label_node.offset_x>rightmost_label.offset_x) ) {
						rightmost_label=label_node;
					}
				}
			}
		}
		if( keep_window_offset ) {
			if( this.m_prev_first_column!=null ) {
				// make the former first column appear at the same offset
				this.m_window_offset.x+=this.m_pixels_per_unit*this.m_prev_first_column.absolute_x;
			}
		}else {
			// set window offset to the best value, for some value of best
			var guide_node= master!=null ? master : rightmost_label!=null ? rightmost_label : rightmost_leaf;
			if( guide_node!=null ) {
				// for y, make guide_node appear in the center
				this.m_window_offset.y=this.m_pixels_per_unit*guide_node.absolute_y-this._diagram_height()/2;
				// for x, if diagram fits in the window, center it. Otherwise, make guide_node appear at the right side.
				if( current_x*this.m_pixels_per_unit<this._diagram_width() ) {
					this.m_window_offset.x=-Math.floor( this._diagram_width()-current_x*this.m_pixels_per_unit )/2;
				}else {
					var rightmost_x=guide_node.date_column.absolute_x+guide_node.offset_x;
					if( this.m_labels[guide_node.id]!=null ) {
						rightmost_x+=GitDiagram._g_absolute_label_letter_width*this._label_text( this.m_labels[guide_node.id] ).length;
					}
					this.m_window_offset.x=this.m_pixels_per_unit*rightmost_x-this._diagram_width()+this.m_node_pixel_size;
				}
			}
		}
	}
	if( this.m_style=="by-commit" ) {
		this._place_by_commit_finish();
	}
	this.m_ui_handler( this.m_ui_handler_arg, "place", this, "end" );
}
GitDiagram.prototype.clear=function()
{
	this._reset_drawing_divs();
	this._reset_placement_data();
	for( var node_id in this.m_nodes ) {
		var node=this.m_nodes[node_id];
		delete node.date_column;
		delete node.parents;
		delete node.children;
	}
	this.m_nodes={};
	this.m_labels={};
	delete this.m_prev_first_column;
	this.m_date_columns=[];
	this.m_repos=[];
	this.m_start_more_ids=[];
}
GitDiagram.prototype.get_start_more_ids=function()
{
	return this.m_start_more_ids;
}
// the result is correct after place_nodes
GitDiagram.prototype.get_commit_count=function()
{
	return this.m_node_count;
}
GitDiagram.prototype.select_node=function( node_id, color )
{
	var node=this.m_nodes[node_id];
	var border= color!=null ?
		("2px solid "+color)
		: node.parents.length==0 ?
			("1px solid "+GitDiagram._g_color_node_background) // root nodes are special
			: "none";
	var node_elements=this._node_elements_for_id( node_id );
	var i;
	for( i=0; i<node_elements.length; ++i ) {
		node_elements[i].style.border=border;
	}
}
// helper functions
GitDiagram._add_repo=function( repos, repo ) // returns true when added
{
	for( var repo_i=0; repo_i<repos.length; ++repo_i ) {
		if( repos[repo_i]==repo ) {
			return false;
		}
	}
	repos.push( repo );
	return true;
}
GitDiagram._get_node_primary_children=function( node, exclude_child )
{
	var primary_children=[];
	if( node!=null ) {
		for( var child_i=0; child_i!=node.children.length; ++child_i ) {
			var child=node.children[child_i];
			if( child.parents[0]==node && (exclude_child==null || exclude_child!=child)) {
				primary_children.push( child );
			}
		}
	}
	return primary_children;
}
GitDiagram._insert_date_column=function( date_columns, date, style )
{
	// binary search sorted date_columns array, insert if not found
	var date_column;
	if( date_columns.length==0 ) {
		date_column={ date: date, width: 0, lines: [] };
		date_columns.push( date_column );
	}else {
		var low=0;
		var high=date_columns.length-1;
		if( date<date_columns[low].date ) {
			date_column={ date: date, width: 0, lines: [] };
			date_columns.unshift( date_column );
		}else if( date>date_columns[high].date ) {
			date_column={ date: date, width: 0, lines: [] };
			date_columns.push( date_column );
		}else {
			while( low!=high ) {
				var mid=Math.floor( (high+low)/2 );
				if( date<=date_columns[mid].date ) {
					high=mid;
				}else if( date>=date_columns[mid+1].date ) {
					low=mid+1;
				}else {
					date_column={ date: date, width: 0, lines: [] };
					date_columns.splice( mid+1, 0, date_column );
					break;
				}
			}
			if( low==high ) { // there were no break in the loop, and date_columns[low].date<=date<=date_columns[high].date
				if( style=="by-commit" ) { // each node gets its own column
					date_column={ date: date, width: 0, lines: [] };
					date_columns.splice( low+1, 0, date_column );
				}else {
					date_column=date_columns[low];
				}
			}
		}
	}
	return date_column;
}
GitDiagram._node_absolute_x=function( node )
{
	return node.date_column.absolute_x+node.offset_x;
}
GitDiagram._line_absolute_y=function( line_i )
{
	return (line_i+0.5)*GitDiagram._g_step_x["by-commit"];
}
GitDiagram.prototype._reset_drawing_divs=function()
{
	// re-create line and node divs after each reset
	if( this.m_jsg ) {
		this.m_jsg.clear();
	}
	this.m_diagram_htm="";
	this.m_background_htm="";
}
GitDiagram.prototype._reset_placement_data=function()
{
	// clear things set by placement algorithm
	for( var label_id in this.m_labels ) {
		delete this.m_labels[label_id].absolute_pos;
	}
	for( var node_id in this.m_nodes ) {
		var node=this.m_nodes[node_id];
		if( node.line_rightmost_node!=null ) {
			delete node.line_rightmost_node;
		}
		if( node.coalesced_nodes!=null ) {
			delete node.coalesced_nodes;
		}
		if( node.coalesced_to!=null ) {
			delete node.coalesced_to;
		}
	}
	this.m_date_columns=[];
}
GitDiagram.prototype._label_text=function( label )
{
	var show_repo=this.m_repos.length>1;
	var text="";
	for( var tag_i=0; tag_i<label.tags.length; ++tag_i ) {
		if( text.length!=0 ) {
			text+=",";
		}
		var tag=label.tags[tag_i];
		if( show_repo ) {
			text+=tag.repo+":";
		}
		text+=tag.name;
	}
	return text;
}
GitDiagram._is_label_master=function( label )
{
	if( label!=null ) {
		for( var tag_i=0; tag_i<label.tags.length; ++tag_i ) {
			if( label.tags[tag_i].name=="master" ) {
				return true;
			}
		}
	}
	return false;
}
// colors
GitDiagram._g_color_month_bottom_line="#444";
GitDiagram._g_color_month_right_line="#888";
GitDiagram._g_color_odd_day_background="#f6f6ea";
GitDiagram._g_color_even_day_background="#ffffff";
GitDiagram._g_color_trunk_line="#420";
GitDiagram._g_color_branch_line="#420";
GitDiagram._g_color_merge_line="#bce";
GitDiagram._g_color_merge_arrow="#bce";
GitDiagram._g_color_root_node_background="#fefef0";
GitDiagram._g_color_node_background="#330";
GitDiagram._g_color_node_label="#0a8000";
GitDiagram._g_color_line_label="#686868";
// font for months, dates and labels
GitDiagram._g_font="sans-serif";
GitDiagram._g_font_size="11px";
// dimensions in pixels, for drawing
GitDiagram._g_month_height_pixels=12;
GitDiagram._g_day_height_pixels=13;

// large
GitDiagram._g_node_pixel_size={ "by-date": 7, "by-commit": 6 };
GitDiagram._g_arrow_length=12;
GitDiagram._g_arrow_width=9;

/* // small
GitDiagram._g_node_pixel_size=4;
GitDiagram._g_arrow_length=2;
GitDiagram._g_arrow_width=3;
*/
// absolute dimensions, for placement. Converted to pixels with m_pixels_per_unit member of the Diagram object.
GitDiagram._g_step_x={ "by-date": 0.7, "by-commit": 1 }; // in proportion to step_y which is 1 (value for by-commit being 1 is essential since in pixels, distance between nodes on x axis must be equal to the log table line height)
GitDiagram._g_branch_angle=0.27; // cosine
GitDiagram._g_absolute_label_height=0.8; // values just vaguely resembling actual sizes, never related to anything in drawing, used only in node placement algorithm to ensure that labels do not overlap
GitDiagram._g_absolute_label_letter_width=0.25;

GitDiagram._g_month_names=["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

GitDiagram._g_line_colors=[
"#06ea3b", // green
"#243aff", // blue
"#ea2a2a", // red
"#32fbfb", // light blue
"#ccbb00", // dark yellow
"#b535c1", // magenta
"#444444", // grey
"#ff817d", // pink
"#c12279", // reddish-violet
"#f98519" // orange
];

// drawing functions
GitDiagram.prototype._find_container_origin=function()
{
	var elm=this.m_container_element;
	var container_pos=Motion.get_page_coords( elm );
	var positioned_pos={ x: 0, y: 0 };
	var doc=this.m_container_element.ownerDocument;
	// find positioned element (relative to which everything in container is positioned)
	while( elm!=null && elm!=doc.body ) {
		var position="";
		if( elm.currentStyle!=null ) {
			position=elm.currentStyle.position;
		}else if( doc.defaultView!=null && doc.defaultView.getComputedStyle!=null ) {
			position=doc.defaultView.getComputedStyle( elm, "" ).getPropertyValue( "position" );
		}
		if( position!="" && position!="static" ) {
			positioned_pos=Motion.get_page_coords( elm );
			break;
		}
		elm=elm.parentNode;
	}
	this.m_container_origin={ x: container_pos.x-positioned_pos.x, y: container_pos.y-positioned_pos.y };
}
GitDiagram.prototype._to_pixels_x=function( x )
{
	return x*this.m_pixels_per_unit-this.m_window_offset.x;
}
GitDiagram.prototype._to_pixels_y=function( y )
{
	return y*this.m_pixels_per_unit-this.m_window_offset.y;
}
// the only place where diagram_width and diagram_height are used in by-commit drawing
// is in _div_htm, and there they must not be swapped
GitDiagram.prototype._diagram_width=function()
{
	return this.m_container_width;
}
GitDiagram.prototype._diagram_height=function()
{
	var header_height=this.m_style=="by-date" ? GitDiagram._g_month_height_pixels+GitDiagram._g_day_height_pixels : 0;
	return this.m_container_element.clientHeight-header_height;
}
GitDiagram.prototype._max_column_x=function()
{
	return this.m_style=="by-date" ? this.m_container_element.clientWidth : this.m_container_element.clientHeight;
}
GitDiagram.prototype._make_id=function( tag, id )
{
	return "gitdiagram"+this.m_diagram_id+"__"+tag+"__"+id;
}
GitDiagram.prototype._match_id=function( element_id )
{
	if( element_id!=null && element_id.match( "^gitdiagram"+this.m_diagram_id+"__(\\w+)__(\\w+)$" ) ) {
		return { tag: RegExp.$1, id: RegExp.$2 };
	}
	return null;
}
GitDiagram.prototype._div_htm=function( arg )
{
	var x;
	var y;
	var clip_x;
	var clip_y;
	var s=' style="';
	var id="";
	var text="";
	var width_height={};
	for( var sn in arg ) {
		var val=arg[sn];
		if( sn=="id" ) {
			id=' id="'+val+'"';
		}else if( sn=="text" ) {
			text=val;
		}else if( sn=="clip_x" ) {
			clip_x=true;
		}else if( sn=="clip_y" ) {
			clip_y=true;
		}else if( sn=="clip" ) {
			clip_x=true;
			clip_y=true;
		}else if( sn=="x" && val!=null ) {
			x=Math.floor( val );
		}else if( sn=="y" && val!=null ) {
			y=Math.floor( val );
		}else if( sn=="abs_x" && val!=null ) {
			x=Math.floor( this._to_pixels_x( val ) );
		}else if( sn=="abs_y" && val!=null ) {
			y=Math.floor( this._to_pixels_y( val ) );
		}else if( (sn=="width" || sn=="height") && val!=null ) {
			width_height[sn]=Math.floor( val );
		}else if( (sn=="abs_width" || sn=="abs_height") && val!=null ) {
			width_height[sn.substring( 4 )]=Math.floor( val*this.m_pixels_per_unit );
		}else {
			s+=' '+sn+':'+val+';';
		}
	}
	if( this.m_style=="by-commit" ) {
		// undo x offset added in draw_by_commit, change x direction, and rotate
		if( x!=null ) {
			x=-(x-this.m_container_element.clientHeight);
		}
		var t=x;
		x=y;
		y=t;
		t=width_height["width"];
		width_height["width"]=width_height["height"];
		width_height["height"]=t;
		if( y!=null && width_height["height"]!=null ) {
			y-=width_height["height"];
		}
	}

	if( width_height["width"]!=null ) {
		s+=" width:"+width_height["width"]+"px;";
	}
	if( width_height["height"]!=null ) {
		s+=" height:"+width_height["height"]+"px;";
	}
	if( x!=null ) {
		s+=' left:'+x+'px;';
	}
	if( y!=null ) {
		s+=' top:'+y+'px;';
	}
	if( x!=null && y!=null ) {
		s+=' position: absolute;';
		if( clip_x!=null || clip_y!=null ) {
			var clip_rect={ top: 0, right: 10000, bottom: 1000, left: 0 };
			if( clip_x!=null ) {
				clip_rect.left=-x;
				clip_rect.right=-x+this._diagram_width();
			}
			if( clip_y!=null ) {
				clip_rect.top=-y;
				clip_rect.bottom=-y+this._diagram_height();
			}
			s+=' clip: rect('+clip_rect.top+'px '+clip_rect.right+'px '+clip_rect.bottom+'px '+clip_rect.left+'px);';
		}
	}
	s+='"';
	return '<div'+id+s+'>'+text+'</div>';
}
GitDiagram.prototype._draw_month_div=function( month, year, month_start_x, month_end_x, last )
{
	this.m_background_htm+=this._div_htm( { "font-family": GitDiagram._g_font, "font-size": GitDiagram._g_font_size, overflow: "visible", "text-align": "center",
		"border-bottom": "1px solid "+GitDiagram._g_color_month_bottom_line,
		"border-right" : last ? "none" : "1px solid "+GitDiagram._g_color_month_right_line,
		cursor: "move", overflow: "hidden",
		width: month_end_x-month_start_x-1, height: GitDiagram._g_month_height_pixels,
		x: month_start_x, y: -(this.m_container_element.clientHeight-this._diagram_height()),
		text: GitDiagram._g_month_names[month]+" "+year
	} );
}
GitDiagram.prototype.by_commit_column_height=function( date_column )
{
	return date_column.lines.length*this.m_pixels_per_unit;
}
GitDiagram.prototype._draw_date_column_divs=function( window_pixels )
{
	var current_x=null;
	var odd=false;
	var prev_month;
	var prev_year;
	var prev_month_x;
	var prev_lines={}; // line rightmost node id => { y: line y pos, prev_x: first x where line y pos become y }
	for( var date_column_i=0; date_column_i<this.m_date_columns.length; ++date_column_i ) {
		var date_column=this.m_date_columns[date_column_i];
		var next_x=date_column.absolute_x+date_column.width;
		next_x=this._to_pixels_x( next_x );
		var last=false;
		if( next_x>0 ) {
			var dt=new Date( date_column.date );
			var date=dt.getDate();
			var month=dt.getMonth();
			var year=dt.getFullYear();
			if( current_x==null ) {
				current_x=Math.max( 1, next_x-(date_column.width*this.m_pixels_per_unit) );
				prev_month=month;
				prev_year=year;
				prev_month_x=current_x;
			}
			if( next_x>=this._max_column_x() ) {
				next_x=this._max_column_x();
				last=true;
			}
			// draw it
			var y=this.m_style=="by-date" ? -(this.m_container_element.clientHeight-this._diagram_height())+GitDiagram._g_month_height_pixels
							: 0;
			var height=this.m_style=="by-date" ? this.m_container_element.clientHeight-GitDiagram._g_month_height_pixels
							: this.by_commit_column_height( date_column );
			var text=this.m_style=="by-date" ? date : "";
			this.m_background_htm+=this._div_htm( { "font-family": GitDiagram._g_font, "font-size": GitDiagram._g_font_size,
				overflow: "hidden", "text-align": "center",
				"background-color" : odd ? GitDiagram._g_color_odd_day_background : GitDiagram._g_color_even_day_background,
				width: next_x-current_x, height: height, x: current_x, y: y,
				text: text
			} );
			if( this.m_style=="by-date" ) {
				if( month!=prev_month || year!=prev_year ) {
					this._draw_month_div( prev_month, prev_year, prev_month_x, current_x, false );
					prev_month=month;
					prev_year=year;
					prev_month_x=current_x;
				}
				if( last || date_column_i==this.m_date_columns.length-1 ) {
					this._draw_month_div( prev_month, prev_year, prev_month_x, next_x, true );
				}
			}
			if( this.m_style=="by-commit" ) { // each column has exactly one node, so draw it here
				this._draw_node_div( date_column.node );
				// draw trunk lines here too
				var new_lines={};
				this._draw_by_commit_lines( window_pixels, date_column, last, prev_lines, new_lines, date_column_i );
				prev_lines=new_lines;
			}
			if( last ) {
				break;
			}
			current_x=next_x;
		}
		odd=!odd;
	}
}
GitDiagram.prototype._draw_by_commit_lines=function( window_pixels, date_column, last, prev_lines, new_lines, date_column_i )
{
	if( date_column.short_merge ) {
		var start_node=this.m_date_columns[date_column_i-1].node;
		var line_color=start_node.line_leftmost_node.line_rightmost_node.line_color;
		this._clip_and_draw_line( { abs_start_x: GitDiagram._node_absolute_x( start_node ),
					abs_start_y: start_node.absolute_y,
					abs_end_x: GitDiagram._node_absolute_x( date_column.node ),
					abs_end_y: date_column.node.absolute_y
					}, window_pixels, line_color, 1 );
	}
	for( var line_i=0; line_i<date_column.lines.length; ++line_i ) {
		var line_id=date_column.lines[line_i].start_node.id;
		var line_kind=date_column.lines[line_i].kind;
		var line_index=line_kind+line_id+date_column.lines[line_i].end_node.id;
		new_lines[line_index]={ y: GitDiagram._line_absolute_y( line_i ),
					kind: line_kind,
					id: line_id
				};
		if( prev_lines[line_index]==null ) {
			new_lines[line_index].prev_x=GitDiagram._node_absolute_x( date_column.node );
			if( line_kind=="trunk" ) {
				// draw branch line
				var branch_start_node=date_column.lines[line_i].start_node;
				if( branch_start_node!=null && branch_start_node.offset_y!=null && branch_start_node.offset_y!=0 ) {
					var branch_parent=branch_start_node.parents[0];
					if( branch_parent!=null ) {
						var line_color=branch_start_node.line_rightmost_node.line_color;
						this._clip_and_draw_line( { abs_start_x: GitDiagram._node_absolute_x( branch_parent ),
									start_y: this._to_pixels_y( branch_parent.absolute_y )-1,
									abs_end_x: GitDiagram._node_absolute_x( date_column.node ),
									end_y: this._to_pixels_y( GitDiagram._line_absolute_y( line_i ) )-1
									}, window_pixels, line_color, 3 );
					}
				}
			}else if( line_kind=="merge" ) {
				// draw the beginning of a merge line
				var merge_start_node=date_column.lines[line_i].start_node;
				var line_color=merge_start_node.line_leftmost_node.line_rightmost_node.line_color;
				var end_x= date_column.node.id==date_column.lines[line_i].end_node.id ?
								  date_column.absolute_x // merge line ends at this column
								: GitDiagram._node_absolute_x( date_column.node );
				this._clip_and_draw_line( { abs_start_x: GitDiagram._node_absolute_x( merge_start_node ),
							start_y: this._to_pixels_y( merge_start_node.absolute_y )-1,
							abs_end_x: end_x,
							end_y: this._to_pixels_y( GitDiagram._line_absolute_y( line_i ) )-1
							}, window_pixels, line_color );
			}
		}else {
			if( prev_lines[line_index].y==new_lines[line_index].y ) {
				new_lines[line_index].prev_x=prev_lines[line_index].prev_x; // vertical line continues
			}else {
				var new_x=GitDiagram._node_absolute_x( date_column.node );
				var line_color=date_column.lines[line_i].start_node.line_leftmost_node.line_rightmost_node.line_color;
				var line_width= line_kind=="trunk" ? 3 : 1;
				this._draw_by_commit_straight_line( prev_lines[line_index], new_x-date_column.width, line_color, line_width );
				this._clip_and_draw_line( { abs_start_x: new_x-date_column.width, abs_end_x: new_x,
							start_y: this._to_pixels_y( prev_lines[line_index].y )-1,
							end_y: this._to_pixels_y( new_lines[line_index].y )-1
							}, window_pixels, line_color, line_width );
				new_lines[line_index].prev_x=new_x;
			}
		}
		if( line_kind=="trunk"
		  && line_id==date_column.node.line_leftmost_node.id
		  && date_column.node.id==date_column.lines[line_i].start_node.line_rightmost_node.id ) {
			new_lines[line_index].ended=true;
		}
	}
	for( var prev_i in prev_lines ) {
		if( new_lines[prev_i]==null ) {
			var line_color=this.m_nodes[prev_lines[prev_i].id].line_leftmost_node.line_rightmost_node.line_color;
			var new_x=GitDiagram._node_absolute_x( date_column.node )-date_column.width;
			if( prev_lines[prev_i].kind=="trunk" ) {
				this._draw_by_commit_straight_line( prev_lines[prev_i], new_x, line_color, 3 );
			}else if( prev_lines[prev_i].kind=="merge" ) {
				this._draw_by_commit_straight_line( prev_lines[prev_i], new_x, line_color, 1 );
				this._clip_and_draw_line( { abs_start_x: new_x,
								start_y: this._to_pixels_y( prev_lines[prev_i].y )-1,
								abs_end_x: GitDiagram._node_absolute_x( date_column.node ),
								end_y: this._to_pixels_y( date_column.node.absolute_y )-1
							}, window_pixels, line_color );

			}
		}
	}
	if( last ) {
		for( var new_i in new_lines ) {
			var new_x=GitDiagram._node_absolute_x( date_column.node );
			if( !new_lines[new_i].ended ) {
				new_x+=date_column.width/2;
			}
			this._draw_by_commit_straight_line( new_lines[new_i], new_x,
									this.m_nodes[new_lines[new_i].id].line_leftmost_node.line_rightmost_node.line_color, new_lines[new_i].kind=="trunk" ? 3 : 1 );
		}
	}
}
GitDiagram.prototype._draw_by_commit_straight_line=function( prev_pos, new_x, line_color, line_width )
{
	if( new_x>prev_pos.prev_x ) {
		// vertical line has non-zero length
		this.m_diagram_htm+=this._div_htm( { "z-index": 3, "font-size": "1px", "border-left": line_width+"px solid "+line_color,
			abs_x: prev_pos.prev_x, abs_width: new_x-prev_pos.prev_x,
			y: this._to_pixels_y( prev_pos.y )-1, height: 1,
			clip: true
		} );
	}
}
GitDiagram.prototype._draw_by_date_line=function( line_start_x, line_end_x, line_y, line_label )
{
	this.m_diagram_htm+=this._div_htm( { "z-index": 3, "font-size": "1px", "border-top": "1px solid "+GitDiagram._g_color_trunk_line,
		abs_x: line_start_x, abs_y: line_y, abs_width: line_end_x-line_start_x, height: 1,
		clip: true
	} );
	if( line_label!=null ) {
		var label_width=GitDiagram._g_absolute_label_letter_width*line_label.length*this.m_pixels_per_unit;
		this.m_diagram_htm+=this._div_htm( { "z-index": 3, x: this._diagram_width()-label_width, y: this._to_pixels_y( line_y )+1,
			color: GitDiagram._g_color_line_label, "font-family": GitDiagram._g_font, "font-size": GitDiagram._g_font_size,
			text: line_label
		} );
	}
}
GitDiagram.prototype._draw_node_div=function( node )
{
	var node_color= node.parents.length==0 ? GitDiagram._g_color_root_node_background : GitDiagram._g_color_node_background;
	var border= node.parents.length==0 ? "1px solid "+GitDiagram._g_color_node_background : "none";
	var size=this.m_node_pixel_size;
	var div_x=this._to_pixels_x( GitDiagram._node_absolute_x( node ) )-size/2;
	var div_y=this._to_pixels_y( node.absolute_y )-size/2;
	var htm_arg={ id: this._make_id( "node", node.id ), "z-index": 4, "background-color": node_color, "font-size": "1px", border: border,
		x: div_x, y: div_y, width: size, height: size,
		clip: true // clip exactly
	};
	this.m_diagram_htm+=this._div_htm( htm_arg );
	if( node.coalesced_nodes!=null ) {
		htm_arg.id=this._make_id( "noded", node.id );
		htm_arg.x=div_x+3*this.m_node_pixel_size/8;
		htm_arg.y=div_y+3*this.m_node_pixel_size/8;
		this.m_diagram_htm+=this._div_htm( htm_arg );
	}
	// draw label, if present
	if( this.m_style=="by-date" && this.m_labels[node.id]!=null ) {
		var label_color=GitDiagram._g_color_node_label;
		this.m_diagram_htm+=this._div_htm( { id: this._make_id( "label", node.id ), "z-index": 4, 
			color: label_color, "border-left": "1px solid "+label_color,
			"padding-bottom": 0, "padding-left": "2px", "padding-top": 0, 
			"font-family": GitDiagram._g_font, "font-size": GitDiagram._g_font_size, overflow: "visible", x: div_x, y: div_y,
			clip_x: true
		} );
	}
}
GitDiagram.prototype._node_elements_for_id=function( id )
{
	var elements=[];
	var node=this.m_nodes[id];
	if( node.coalesced_to!=null ) {
		node=node.coalesced_to;
	}
	var element=this.m_container_element.ownerDocument.getElementById( this._make_id( "node", node.id ) );
	if( element!=null ) {
		elements.push( element );
	}
	if( node.coalesced_nodes!=null ) {
		element=this.m_container_element.ownerDocument.getElementById( this._make_id( "noded", node.id ) );
		if( element!=null ) {
			elements.push( element );
		}
	}
	return elements;
}
GitDiagram._clip_line=function( line, window )
{
	// silly, but obvious
	var new_start_x;
	var new_end_x;
	var new_start_y;
	var new_end_y;
	var x_direction=1;
	if( line.start_x<=line.end_x ) {
		new_start_x=Math.max( line.start_x, window.left );
		new_end_x=Math.min( line.end_x, window.right );
	}else {
		x_direction=-1;
		new_start_x=Math.min( line.start_x, window.right );
		new_end_x=Math.max( line.end_x, window.left );
	}
	var dy=line.end_y-line.start_y;
	var dx=line.end_x-line.start_x;
	if( dx!=0 ) {
		line.start_y+=(new_start_x-line.start_x)*dy/dx;
		line.end_y-=(line.end_x-new_end_x)*dy/dx;
	}
	var y_direction=1;
	if( line.start_y<=line.end_y ) {
		new_start_y=Math.max( line.start_y, window.top );
		new_end_y=Math.min( line.end_y, window.bottom );
	}else {
		y_direction=-1;
		new_start_y=Math.min( line.start_y, window.bottom );
		new_end_y=Math.max( line.end_y, window.top );
	}
	if( dy!=0 ) {
		new_start_x+=(new_start_y-line.start_y)*dx/dy;
		new_end_x-=(line.end_y-new_end_y)*dx/dy;
	}
	line.start_x=new_start_x;
	line.start_y=new_start_y;
	line.end_x=new_end_x;
	line.end_y=new_end_y;
	return line.start_x*x_direction<=line.end_x*x_direction && line.start_y*y_direction<=line.end_y*y_direction;
}
GitDiagram.prototype._clip_and_draw_line=function( line_rect, window_pixels, color, line_width )
{
	if( line_rect.abs_start_x!=null ) {
		line_rect.start_x=this._to_pixels_x( line_rect.abs_start_x );
	}
	if( line_rect.abs_end_x!=null ) {
		line_rect.end_x=this._to_pixels_x( line_rect.abs_end_x );
	}
	if( line_rect.abs_start_y!=null ) {
		line_rect.start_y=this._to_pixels_y( line_rect.abs_start_y );
	}
	if( line_rect.abs_end_y!=null ) {
		line_rect.end_y=this._to_pixels_y( line_rect.abs_end_y );
	}
	if( this.m_style=="by-commit" ) {
		// undo x offset added in draw_by_commit, change x direction, and rotate
		line_rect.start_x=-(line_rect.start_x-this.m_container_element.clientHeight);
		line_rect.end_x=-(line_rect.end_x-this.m_container_element.clientHeight);
		var t=line_rect.start_x;
		line_rect.start_x=line_rect.start_y;
		line_rect.start_y=t;
		t=line_rect.end_x;
		line_rect.end_x=line_rect.end_y;
		line_rect.end_y=t;
	}
	if( GitDiagram._clip_line( line_rect, window_pixels ) ) {
		if( this.m_jsg!=null ) {
			this.m_jsg.setColor( color );
			var old_stroke;
			if( line_width!=null ) {
				old_stroke=this.m_jsg.stroke;
				this.m_jsg.setStroke( line_width );
			}
			this.m_jsg.drawLine( Math.floor( line_rect.start_x ), Math.floor( line_rect.start_y ), Math.floor( line_rect.end_x ), Math.floor( line_rect.end_y ) );
			if( line_width!=null ) {
				this.m_jsg.setStroke( old_stroke );
			}
		}
	}
}
GitDiagram.prototype._draw_middle_arrow=function( rect, window_rect, color )
{
	var arrow_base={ x: (rect.start_x+rect.end_x)/2, y: (rect.start_y+rect.end_y)/2 };
	if( arrow_base.x>=window_rect.left && arrow_base.x<=window_rect.right && arrow_base.y>=window_rect.top && arrow_base.y<=window_rect.bottom ) {
		var dx=rect.end_x-rect.start_x;
		var dy=rect.end_y-rect.start_y;
		var d=Math.sqrt( dx*dx+dy*dy );
		if( d!=0 ) {
			var arrow_tip={ x: arrow_base.x+GitDiagram._g_arrow_length*dx/d, y: arrow_base.y+GitDiagram._g_arrow_length*dy/d };
			var arrow_left={ x: arrow_base.x-GitDiagram._g_arrow_width*dy/(d*2), y: arrow_base.y+GitDiagram._g_arrow_width*dx/(d*2) };
			var arrow_right={ x: arrow_base.x+GitDiagram._g_arrow_width*dy/(d*2), y: arrow_base.y-GitDiagram._g_arrow_width*dx/(d*2) };
			if( this.m_jsg!=null ) {
				this.m_jsg.setColor( color );
				this.m_jsg.fillPolygon( [arrow_tip.x, arrow_left.x, arrow_right.x], [arrow_tip.y, arrow_left.y, arrow_right.y] );
			}
		}
	}
}
GitDiagram.prototype._draw_by_date=function( window_pixels )
{
	// keep the first column, if present, for preserving window_offset when requested
	this.m_prev_first_column= this.m_date_columns.length>0 ? this.m_date_columns[0] : null;
	// prepare htm
	var window_absolute_left=this.m_window_offset.x/this.m_pixels_per_unit;
	var window_absolute_top=this.m_window_offset.y/this.m_pixels_per_unit;
	var window_absolute_right=window_absolute_left+this._diagram_width()/this.m_pixels_per_unit;
	var window_absolute_bottom=window_absolute_top+this._diagram_height()/this.m_pixels_per_unit;
	var node_absolute_size=this.m_node_pixel_size/this.m_pixels_per_unit;
	for( var node_id in this.m_nodes ) {
		var node=this.m_nodes[node_id];
		if( node.date!=null ) {
			// first, if there is horizontal line starting at the node, draw it.
			var line_start_x=null;
			var line_end_x=null;
			if( node.parents[0]==null || node.parents[0].author==null ) {
				line_start_x=GitDiagram._node_absolute_x( node );
				line_end_x=GitDiagram._node_absolute_x( node.line_rightmost_node );
			}else if( node.offset_y!=null && node.offset_y!=0 ) {
				line_start_x=GitDiagram._node_absolute_x( node.parents[0] )+GitDiagram._g_branch_angle*Math.abs( node.offset_y );
				line_end_x=GitDiagram._node_absolute_x( node.line_rightmost_node );
			}
			if( line_start_x!=null && line_end_x!=null ) {
				// clip it
				line_start_x=Math.max( line_start_x, window_absolute_left );
				line_end_x=Math.min( line_end_x, window_absolute_right );
				var line_start_y=Math.max( node.absolute_y, window_absolute_top );
				var line_end_y=Math.min( node.absolute_y, window_absolute_bottom );
				if( line_start_x<=line_end_x && line_start_y<=line_end_y ) {
					var label_text=null;
					var label_id=node.line_rightmost_node.id;
					if( this.m_labels[label_id]!=null && line_end_x<GitDiagram._node_absolute_x( node.line_rightmost_node ) ) {
						label_text=this._label_text( this.m_labels[label_id] )+" >";
					}
					this._draw_by_date_line( line_start_x, line_end_x, node.absolute_y, label_text );
				}
			}
			// second, draw the node bullet
			// roughly assume largest size for every node, exact clipping is done later in _draw_node_div
			var node_start_x=GitDiagram._node_absolute_x( node )-node_absolute_size; 
			var node_end_x=node_start_x+2*node_absolute_size;
			var node_start_y=node.absolute_y-node_absolute_size;
			var node_end_y=node_start_y+2*node_absolute_size;
			// clip roughly
			node_start_x=Math.max( node_start_x, window_absolute_left );
			node_end_x=Math.min( node_end_x, window_absolute_right );
			node_start_y=Math.max( node_start_y, window_absolute_top );
			node_end_y=Math.min( node_end_y, window_absolute_bottom );
			if( node_start_x<=node_end_x && node_start_y<=node_end_y ) {
				if( node.coalesced_to==null ) {
					this._draw_node_div( node ); // clip exactly inside _draw_node_div
				}
			}
			// then draw branch and merge lines
			var branch_end_node=null;
			var child_i;
			for( child_i=0; child_i<node.children.length; ++child_i ) {
				var child=node.children[child_i];
				if( node==child.parents[0] ) { // it's a branch or a trunk
					if( child.offset_y!=null && child.offset_y!=0 ) {
						if( branch_end_node==null || Math.abs( child.offset_y )>Math.abs( branch_end_node.offset_y ) ) { 
							// it's a branch
							branch_end_node=child;
						}
					}
				}else { // it's a merge
					var merge_rect={ abs_start_x: GitDiagram._node_absolute_x( node ), abs_start_y: node.absolute_y,
								abs_end_x: GitDiagram._node_absolute_x( child ), abs_end_y: child.absolute_y
					};
					this._clip_and_draw_line( merge_rect, window_pixels, GitDiagram._g_color_merge_line );
					this._draw_middle_arrow( merge_rect, window_pixels, GitDiagram._g_color_merge_arrow );
				}
			}
			// draw branch line
			if( branch_end_node!=null ) {
				var branch_rect={ abs_start_x: GitDiagram._node_absolute_x( node ),
							abs_end_x: GitDiagram._node_absolute_x( node )+GitDiagram._g_branch_angle*Math.abs( branch_end_node.offset_y ),
							abs_start_y: node.absolute_y,
							abs_end_y: branch_end_node.absolute_y
				};
				this._clip_and_draw_line( branch_rect, window_pixels, GitDiagram._g_color_branch_line );
			}
		}
	}
	this._draw_date_column_divs();
	this._draw_finish( { width: this._diagram_width(), height: this._diagram_height(),
			x: this.m_container_origin.x, y: this.m_container_origin.y+this.m_container_element.clientHeight-this._diagram_height() } );
}
GitDiagram.prototype._draw_by_commit=function( window_pixels, row_height, scroll_top )
{
	this.m_pixels_per_unit=row_height;
	// for clipping in draw_date_column_divs to work, _to_pixels_x should return values
	// in the range 0..container_size for visible columns, that is -real_pixels+container_size.
	// conversion to real_pixels and rotation is done in div_htm().
	var last_column=this.m_date_columns[this.m_date_columns.length-1];
	this.m_window_offset={ x: (last_column.absolute_x+last_column.width)*this.m_pixels_per_unit-scroll_top-this.m_container_element.clientHeight, y: 0 };
	this._draw_date_column_divs( window_pixels );
	this._draw_finish( {} );
}
GitDiagram.prototype._draw_finish=function( arg )
{
	if( this.m_jsg!=null ) {
		var diagram_div_htm=this._div_htm( { width: arg.width, height: arg.height, x: arg.x, y: arg.y,
			text: this.m_background_htm+this.m_diagram_htm+"<div>"+this.m_jsg.htm+"</div>" // extra div to contain all jsg graphics, to be easily removed to speed up dragging (see on_drag_mouse_move)
		} );
		this.m_jsg.htm=diagram_div_htm;
		this.m_jsg.paint();
	}
	if( this.m_style!="by-commit" ) {
		var diagram_div=this.m_container_element.firstChild;
		// post-draw DOM manipulations
		for( var cn=diagram_div.firstChild; cn!=null; cn=cn.nextSibling ) {
			if( cn.id!=null ) {
				// add text for labels, bottom-align labels with node bullets
				var idtag=this._match_id( cn.id );
				if( idtag!=null ) {
					if( idtag.tag=="label" ) {
						var label=this.m_labels[idtag.id];
						if( label!=null ) {
							cn.appendChild( cn.ownerDocument.createTextNode( this._label_text( label ) ) );
						}
						cn.style.top=(parseInt( cn.style.top )-cn.clientHeight+1)+"px";
						if( this.m_style=="by-commit" ) {
							cn.style.top=(parseInt( cn.style.top )-this.m_node_pixel_size+1)+"px";
						}
					}
					// add popups for node bullets
					if( idtag.tag=="node" || idtag.tag=="noded" ) {
						var node=this.m_nodes[idtag.id];
						if( node!=null ) {
							this.m_ui_handler( this.m_ui_handler_arg, "node_init", this, node, cn );
						}
					}
				}
			}
		}
	}
}
GitDiagram.prototype.draw=function( row_height, scroll_top )
{
	this.m_ui_handler( this.m_ui_handler_arg, "draw", this, "begin" );
	if( this.m_date_columns.length>0 ) {
		this.m_node_pixel_size=GitDiagram._g_node_pixel_size[this.m_style];
		this._reset_drawing_divs();
		this._find_container_origin();
		var window_pixels={ left: 0, top: 0, right: this._diagram_width(), bottom: this._diagram_height() };
		if( this.m_style=="by-date" ) {
			this._draw_by_date( window_pixels );
		}else {
			this._draw_by_commit( window_pixels, row_height, scroll_top );
		}
	}
	this.m_ui_handler( this.m_ui_handler_arg, "draw", this, "end" );
}

// dragging
GitDiagram.prototype.begin_move=function()
{
	// remove all jsg graphics to speed up dragging
	var jsg_div=this.m_container_element.firstChild.lastChild;
	jsg_div.innerHTML="";
}
GitDiagram.prototype.track_move=function( offset )
{
	var container=this.m_container_element;
	var canvas=container.firstChild;
	if( container!=null && canvas!=null ) {
		var original_pos=Motion.get_page_coords( container, true );
		original_pos.y+=GitDiagram._g_month_height_pixels+GitDiagram._g_day_height_pixels;
		Motion.set_page_coords( canvas, original_pos.x+offset.x, original_pos.y+offset.y, true );
	}
}
GitDiagram.prototype.end_move=function( offset )
{
	var diagram=this;
	diagram.m_window_offset.x-=offset.x;
	diagram.m_window_offset.y-=offset.y;
	// without timeout, the mouse sometimes is left locked in selection mode
	setTimeout( function() { diagram.draw(); }, 0.1 );
}

// placement functions
GitDiagram.prototype._assign_offset_x=function( node, parent_node )
{
	if( this.m_style=="by-commit" ) {
		node.offset_x=GitDiagram._g_step_x[this.m_style]/2;
		return;
	}
	if( node.date!=parent_node.date ) {
		node.offset_x=GitDiagram._g_step_x[this.m_style]/2; // it's at the start of the new column
	}else {
		if( node.offset_y==null || node.offset_y==0 ) { // node is on the trunk or branch line
			node.offset_x=parent_node.offset_x;
			if( this.m_labels[node.id]!=null || node.parents.length>1 || parent_node.parents.length>1
			   || node.children.length>1 || parent_node.children.length>1
			   || (node.children.length==1 && node.children[0].parents[0]!=node) ) {
				node.offset_x+=GitDiagram._g_step_x[this.m_style]; // separate
			}else {
				// find the first parent in the same place, record this node in its coalesced_nodes
				var first_parent;
				while( parent_node!=null && parent_node.date==node.date && parent_node.absolute_y==node.absolute_y && parent_node.offset_x==node.offset_x
					&& parent_node.line_rightmost_node==null && parent_node.children.length==1 && this.m_labels[parent_node.id]==null ) {
					first_parent=parent_node;
					parent_node=parent_node.parents[0];
				}
				if( first_parent==null ) {
					node.offset_x+=GitDiagram._g_step_x[this.m_style]; // separate
				}else {
					if( first_parent.coalesced_nodes==null ) {
						first_parent.coalesced_nodes=[first_parent];
					}
					first_parent.coalesced_nodes.push( node );
					node.coalesced_to=first_parent;
				}
			}
		}else { // node is the first on a branch
			node.offset_x=parent_node.offset_x+GitDiagram._g_branch_angle*Math.abs( node.offset_y );
			if( node.children.length>1 ) {
				node.offset_x+=GitDiagram._g_step_x[this.m_style]; // move to the right, to separate branches sprawling from the node from ones from the parent
			}
		}
	}
	// make sure that labels do not overlap
	if( this.m_labels[node.id]!=null ) {
		var this_label=this.m_labels[node.id];
		// in theory, this will not work, since here not all date_colimn widths are calculated yet.
		var this_label_x=0;
		for( var date_column_i=0; date_column_i<this.m_date_columns.length; ++date_column_i ) {
			if( this.m_date_columns[date_column_i].date==node.date ) {
				break;
			}
			this_label_x+=this.m_date_columns[date_column_i].width;
		}
		var node_absolute_size=this.m_node_pixel_size/this.m_pixels_per_unit;
		this_label_x+=node.offset_x-node_absolute_size/2;
		var this_label_y=node.absolute_y-node_absolute_size/2-GitDiagram._g_absolute_label_height;
		for( var label_id in this.m_labels ) {
			var label=this.m_labels[label_id];
			if( label.absolute_pos!=null && Math.abs( label.absolute_pos.y-this_label_y )<=GitDiagram._g_absolute_label_height ) {
				var label_width=GitDiagram._g_absolute_label_letter_width*this._label_text( label ).length;
				var this_label_width=GitDiagram._g_absolute_label_letter_width*this._label_text( this_label ).length;
				var max_left=Math.max( label.absolute_pos.x, this_label_x );
				var min_right=Math.min( label.absolute_pos.x+label_width, this_label_x+this_label_width );
				if( max_left<=min_right ) {
					var this_label_offset=label.absolute_pos.x+label_width-this_label_x;
					this_label_x+=this_label_offset;
					node.offset_x+=this_label_offset;
				}
			}
		}
		this_label.absolute_pos={ x: this_label_x, y: this_label_y };
	}
}
GitDiagram.prototype._get_new_line_color=function()
{
	var new_color=GitDiagram._g_line_colors[this.m_line_color_index];
	++this.m_line_color_index;
	if( this.m_line_color_index>=GitDiagram._g_line_colors.length ) {
		this.m_line_color_index=0;
	}
	return new_color;
}
GitDiagram.prototype._place_by_commit_finish=function()
{
	// propagate leftmost_node, assign line colors
	for( var column_i=0; column_i<this.m_date_columns.length; ++column_i ) {
		var node=this.m_date_columns[column_i].node;
		if( node.line_rightmost_node!=null ) { // _propagate_absolute_y_offset_x should have put this node into column.lines.
			// propagate it to its primary children (assuming that they all belong to the columns with greater column_i)
			node.line_leftmost_node=node;
			var rightmost_node=node.line_rightmost_node; // node to assign line_color to
			var parent_color;
			if( node.parents[0]!=null && node.parents[0].line_leftmost_node!=null
			  && node.parents[0].line_leftmost_node.line_rightmost_node!=null
			  && node.parents[0].line_leftmost_node.line_rightmost_node.line_color!=null ) {
				// line_color is assigned only to the righmost node on each line
				parent_color=node.parents[0].line_leftmost_node.line_rightmost_node.line_color;
			}
			// if the branch had only one commit and lived shorter than one day, color it the same as its parent
			var date_distance=node.line_rightmost_node.date-node.line_leftmost_node.date;
			if( parent_color!=null && date_distance<1000*60*60*24 && rightmost_node.parents[0]==node.parents[0] ) {
				rightmost_node.line_color=parent_color;
			}else {
				var new_color;
				if( this.m_assigned_colors[rightmost_node.id]!=null ) {
					new_color=this.m_assigned_colors[rightmost_node.id];
					if( parent_color!=null && new_color==parent_color ) {
						new_color=this._get_new_line_color();
					}
				}else {
					new_color=this._get_new_line_color();
				}
				// make sure it's different from parent color
				if( parent_color!=null && new_color==parent_color ) {
					new_color=this._get_new_line_color();
				}
				rightmost_node.line_color=new_color;
				this.m_assigned_colors[rightmost_node.id]=new_color;
			}
		}else {
			var parent=node.parents[0];
			if( GitBrowser!=null && GitBrowser.error_show!=null ) { // XXX really, this code should not know a thing about GitBrowser
				if( parent==null ) {
					GitBrowser.error_show( "primary parent is null for non-leftmost node on the line" );
					return;
				}else if( parent.line_leftmost_node==null ) {
					GitBrowser.error_show( "GitDiagram._place_by_commit_finish bug: line_leftmost_node is unassigned for parent of "+node.id );
					return;
				}
			}
			node.line_leftmost_node=parent.line_leftmost_node;
		}
	}
	// place merge lines
	var merge_lines={}; // start node id => { end node id => true } (multimap-like)
	for( var column_i=this.m_date_columns.length; column_i>0; --column_i ) {
		var column=this.m_date_columns[column_i-1];
		var node=column.node;
		delete merge_lines[node.id]; // all straight merge lines with start_id==node.id will end at the previous column
		for( var start_id in merge_lines ) {
			for( var end_id in merge_lines[start_id] ) {
				column.lines.push( { kind: "merge", start_node: this.m_nodes[start_id], end_node: this.m_nodes[end_id] } );
			}
		}
		for( var parent_i=1; parent_i<node.parents.length; ++parent_i ) {
			var start_node=node.parents[parent_i];
			if( start_node.date!=null ) {
				if( column_i>1 && this.m_date_columns[column_i-2].node.id==start_node.id ) {
					column.short_merge=true;
				}else {
					if( merge_lines[start_node.id]==null ) {
						merge_lines[start_node.id]={};
					}
					merge_lines[start_node.id][node.id]=true;
				}
			}
		}
		column.lines.sort( function( line1, line2 ) {
			var r=line1.start_node.absolute_y-line2.start_node.absolute_y;
			if( r==0 ) {
				r=line1.end_node.absolute_y-line2.end_node.absolute_y;
			}
			if( r==0 ) {
				r=line1.end_node.date-line2.end_node.date;
			}
			if( r==0 ) {
				r=line1.start_node.date-line2.start_node.date;
			}
			return r;
		} );
	}
	// assign new absolute_y, shifted towards 0 as close as other lines allow
	for( var column_i=0; column_i<this.m_date_columns.length; ++column_i ) {
		var column=this.m_date_columns[column_i];
		if( column.node.line_leftmost_node!=null ) {
			// find it and assign new absolute y according to the line position
			for( var line_i=0; line_i<column.lines.length; ++line_i ) {
				var line=column.lines[line_i];
				if( line.kind=="trunk" && line.start_node.id==column.node.line_leftmost_node.id ) {
					column.node.absolute_y=GitDiagram._line_absolute_y( line_i );
					break;
				}
			}
		}
	}
}
GitDiagram.prototype._propagate_absolute_y_offset_x=function( node )
{
	// if there is a line starting from this node, populate lines array for each date_column that line goes through
	if( node.line_rightmost_node!=null ) {
		// the line will start one column before node parent, if it has any
		var line_start_date=node.date;
		if( node.parents[0]!=null && node.parents[0].date!=null ) {
			line_start_date=node.parents[0].date+1;
		}
		for( var i=0; i<this.m_date_columns.length; ++i ) {
			if( this.m_date_columns[i].date>=line_start_date && this.m_date_columns[i].date<=node.line_rightmost_node.date ) {
				this.m_date_columns[i].lines.push( { kind: "trunk", start_node: node, end_node: node.line_rightmost_node } );
			}
		}
	}
	var node_children=GitDiagram._get_node_primary_children( node );
	while( node_children.length==1 ) { // cut recursion down a bit - both IE and firefox can't handle it as is. (Opera 8 can).
		var child_node=node_children[0];
		child_node.absolute_y=node.absolute_y+child_node.offset_y;
		this._assign_offset_x( child_node, node );
		// node_children.length==1 <=> no branches
		var required_width=node.offset_x+GitDiagram._g_step_x[this.m_style]/2;
		if( required_width>node.date_column.width ) {
			node.date_column.width=required_width;
		}
		node=child_node;
		node_children=GitDiagram._get_node_primary_children( node );
	}
	var max_branch_span=0;
	for( var child_i=0; child_i<node_children.length; ++child_i ) {
		var child_node=node_children[child_i];
		child_node.absolute_y=node.absolute_y+child_node.offset_y;
		this._assign_offset_x( child_node, node );
		this._propagate_absolute_y_offset_x( child_node );
		if( this.m_style=="by-date" ) {
			max_branch_span=Math.max( max_branch_span, Math.abs( child_node.offset_y*GitDiagram._g_branch_angle ) );
		}
	}
	var required_width=node.offset_x+Math.max( max_branch_span, GitDiagram._g_step_x[this.m_style]/2 );
	if( required_width>node.date_column.width ) {
		node.date_column.width=required_width;
	}
}
GitDiagram.prototype._assign_tentative_offset_x=function( start_node, rightmost_node )
// assign vaguely resembling reality offset_x for use in better branch placement on y axis
// (real offset_x is determined after that placement is complete)
{
	var current_node=rightmost_node;
	var path=[];
	while( current_node!=start_node ) {
		path.push( current_node );
		current_node=current_node.parents[0];
	}
	path.push( start_node );
	var parent_node=null;
	for( var path_i=path.length-1; path_i>=0; --path_i ) {
		var node=path[path_i];
		if( parent_node==null || parent_node.date!=node.date ) {
			node.offset_x=GitDiagram._g_step_x[this.m_style]/2;
		}else {
			node.offset_x=parent_node.offset_x;
			if( this.m_labels[node.id]!=null || node.parents.length>1 || parent_node.parents.length>1
			   || node.children.length>1 || parent_node.children.length>1
			   || (node.children.length==1 && node.children[0].parents[0]!=node) ) {
				node.offset_x+=GitDiagram._g_step_x[this.m_style]; // separate
			}else {
				// find the first parent in the same place, record this node in its coalesced_nodes
				var first_parent;
				while( parent_node!=start_node && parent_node.date==node.date && parent_node.offset_x==node.offset_x
					  && parent_node.children.length==1 && this.m_labels[parent_node.id]==null ) {
					first_parent=parent_node;
					parent_node=parent_node.parents[0];
				}
				if( first_parent==null ) {
					node.offset_x+=GitDiagram._g_step_x[this.m_style]; // separate
				}
			}
		}
		parent_node=node;
	}
}
GitDiagram.prototype._place_node_subtree=function( root_node, leftmost_x )
{
	// horizontal coordinates are dates, increasing to the right.
	// vertical coordinates are integers, relative to the node, increasing downards, with 1 = conventional distance between two adjacent parallel lines.

	// determine structure and shape of a subtree originating from the root_node,

	// The algorithm works like this:

	// determine the rightmost node on the trunk (the trunk will be on the straight line).

	// for each node on the trunk, starting from the rightmost, place other (non-trunk) branches originating from that node protruding in the same direction,
	// alternating that direction (up or down) for each node that has branches.

		// order child nodes somehow, the nearest to the trunk being the first.
		// call place_node_subtree for each child node,
		// shift the subtree to the current direction so as not to intersect with already placed shape
		// the algorithm is guaranteed to work so that subtree can be shifted as far as required in the given direction,
		// in other words, only the clearance given by the limiting shape from the opposite direction should be observed.

		// "shapes" object consists of two arrays, "upper shape" at index -1 and "lower shape" at index 1
		// each array is a sequence of pairs: { x: date, y: offset from the trunk }

	// So...
	root_node.line_rightmost_node=this._find_trunk_rightmost_node( root_node );
	this._assign_tentative_offset_x( root_node, root_node.line_rightmost_node );
	var current_node=root_node.line_rightmost_node;
	var current_shapes={};
	current_shapes[-1]=[ {x: leftmost_x, y: 0}, {x: { date: current_node.date, offset: current_node.offset_x }, y: 0 } ]; // each shape starts as mere line
	current_shapes[1]=[ {x: leftmost_x, y: 0}, {x: { date: current_node.date, offset: current_node.offset_x }, y: 0 } ];
	while( current_node.id!=root_node.id ) { // walk left from the rightmost node
		current_node.offset_y=0;
		var parent_node=current_node.parents[0];
		var branch_nodes=GitDiagram._get_node_primary_children( parent_node, current_node );
		if( branch_nodes.length>0 ) {
			var new_shapes={};
			var branch_offsets={};
			// try placing branches in both directions
			for( var i=0; i<2; ++i ) {
				var direction=1-2*i;
				new_shapes[direction]=current_shapes[direction];
				branch_offsets[direction]=[];
				// for now, do not order branch_nodes in any way
				for( var branch_i=0; branch_i<branch_nodes.length; ++branch_i ) {
					var branch_node=branch_nodes[branch_i];
					var branch_shapes=this._place_node_subtree( branch_node, { date: parent_node.date, offset: parent_node.offset_x } );
					var branch_offset=GitDiagram._determine_branch_offset( branch_i, direction, branch_shapes[-1*direction], new_shapes[direction] );
					new_shapes[direction]=GitDiagram._expand_shape( branch_offset, branch_shapes[direction], new_shapes[direction] );
					branch_offsets[direction].push( branch_offset );
				}
				if( this.m_style=="by-commit" ) { // for by-commit, grow always down
					break;
				}
			}
			// pick one direction which gives narrower subtree
			var best_direction=1;
			if( this.m_style!="by-commit" ) {
				if( Math.abs( branch_offsets[-1*best_direction][branch_nodes.length-1] )<=Math.abs( branch_offsets[best_direction][branch_nodes.length-1] ) ) {
					best_direction=-1*best_direction;
				}
			}
			current_shapes[best_direction]=new_shapes[best_direction];
			for( var branch_i=0; branch_i<branch_nodes.length; ++branch_i ) {
				branch_nodes[branch_i].offset_y=branch_offsets[best_direction][branch_i];
			}
		}
		current_node=parent_node;
	}
	return current_shapes;
}
// Determine the trunk, and the rightmost node on it.
// Gather all leaf nodes. If there is one labeled 'master', thats it. Otherwise, pick the leaf with the with the latest date among labeled ones. Otherwise (all leafs are unlabeled), just pick one with the latest date.
GitDiagram.prototype._find_trunk_rightmost_node=function( node )
{
	var subtree_nodes=[node];
	var master_leaf=null;
	var latest_labeled_leaf=null;
	var latest_leaf=null;
	while( subtree_nodes.length>0 ) {
		var current_node=subtree_nodes[0];
		if( current_node.date==null ) { // there is a gap. pretend we weren't there
			return node;
		}
		subtree_nodes.splice( 0, 1 );
		var primary_children=GitDiagram._get_node_primary_children( current_node );
		if( primary_children.length==0 ) { // it's a leaf
			if( this.m_labels[current_node.id]!=null ) {
				if( GitDiagram._is_label_master( this.m_labels[current_node.id] ) ) {
					master_leaf=current_node;
				}else {
					if( latest_labeled_leaf==null || current_node.date>latest_labeled_leaf.date ) {
						latest_labeled_leaf=current_node;
					}
				}
			}else {
				if( latest_leaf==null || current_node.date>latest_leaf.date ) {
					latest_leaf=current_node;
				}
			}
		}else {
			for( var child_i=0; child_i<primary_children.length; ++child_i ) {
				subtree_nodes.push( primary_children[child_i] );
			}
		}
	}
	return master_leaf!=null ? master_leaf : latest_labeled_leaf!=null ? latest_labeled_leaf : latest_leaf;
}
GitDiagram._determine_branch_offset=function( tentative_abs_offset, direction, branch_shape, trunk_shape )
{
	// return modified tentative_offset so that branch_shape placed at that offset does not intersect with trunk_shape
	// direction is required for determining the sign, since tentative_abs_offset may be 0
	var tentative_offset=tentative_abs_offset*direction;
	var branch_i=0;
	var branch_y=direction*(tentative_offset+branch_shape[0].y);
	var trunk_i=0;
	var trunk_y=direction*trunk_shape[0].y;
	if( GitDiagram._shape_x_less( branch_shape[0].x, trunk_shape[0].x ) ) {
		while( branch_i<branch_shape.length && GitDiagram._shape_x_less( branch_shape[branch_i].x, trunk_shape[0].x ) ) {
			branch_y=direction*(tentative_offset+branch_shape[branch_i].y);
			++branch_i;
		}
	}else if( GitDiagram._shape_x_less( trunk_shape[0].x, branch_shape[0].x ) ) {
		while( trunk_i<trunk_shape.length && GitDiagram._shape_x_less( trunk_shape[trunk_i].x, branch_shape[0].x ) ) {
			trunk_y=direction*trunk_shape[trunk_i].y;
			++trunk_i;
		}
	}
	// when direction ==1 (down), branch_y>trunk_y is ok, branch_y<=trunk_y is bad.
	// when direction == -1 (up), branch_y<trunk_y is ok, branch_y>=trunk_y is bad.
	// when multiplied by the direction, both cases can be treated in the same way.
	var clearance=0;
	while( branch_i<branch_shape.length && trunk_i<trunk_shape.length ) {
		if( branch_y<=trunk_y ) {
			clearance=Math.max( clearance, trunk_y-branch_y );
		}
		var branch_x=branch_shape[branch_i].x
		var trunk_x=trunk_shape[trunk_i].x;
		if( GitDiagram._shape_x_less( branch_x, trunk_x ) ) {
			branch_y=direction*(tentative_offset+branch_shape[branch_i].y);
			++branch_i;
		}else if( GitDiagram._shape_x_less( trunk_x, branch_x ) ) {
			trunk_y=direction*trunk_shape[trunk_i].y;
			++trunk_i;
		}else { // handle simultaneous variations over single point
			var max_trunk_y=trunk_y; // max for trunk, min for branch - increase badness
			while( trunk_i<trunk_shape.length && GitDiagram._shape_x_eq( trunk_shape[trunk_i].x, trunk_x ) ) {
				trunk_y=direction*trunk_shape[trunk_i].y;
				max_trunk_y=Math.max( max_trunk_y, trunk_y );
				++trunk_i;
			}
			var min_branch_y=branch_y;
			while( branch_i<branch_shape.length && GitDiagram._shape_x_eq( branch_shape[branch_i].x, branch_x ) ) {
				branch_y=direction*(tentative_offset+branch_shape[branch_i].y);
				min_branch_y=Math.min( min_branch_y, branch_y );
				++branch_i;
			}
			if( min_branch_y<=max_trunk_y ) {
				clearance=Math.max( clearance, max_trunk_y-min_branch_y );
			}
		}
	}
	++clearance;
	return (tentative_abs_offset+clearance)*direction;
}
GitDiagram._expand_shape=function( branch_offset, branch_shape, trunk_shape )
{
	// returns trunk_shape expanded with branch_shape placed at branch_offset
	// it's assumed that branch_offset always has the same sign as y coords in branch_shape.
	var result=[];
	var branch_y=null;
	var trunk_y=null;
	var branch_i=0;
	var trunk_i=0;
	var prev_result_y=null;
	while( branch_i<branch_shape.length || trunk_i<trunk_shape.length ) {
		var result_x;
		var result_y;
		var max_result_y;
		if( trunk_i==trunk_shape.length ) {
			result_x=branch_shape[branch_i].x;
			result_y=branch_offset+branch_shape[branch_i].y;
			max_result_y=result_y;
			++branch_i;
		}else if( branch_i==branch_shape.length ) {
			result_x=trunk_shape[trunk_i].x;
			result_y=trunk_shape[trunk_i].y;
			max_result_y=result_y;
			++trunk_i;
		}else {
			var branch_x=branch_shape[branch_i].x;
			var trunk_x=trunk_shape[trunk_i].x;
			result_x=GitDiagram._shape_x_min( branch_x, trunk_x );

			var max_branch_y=null;
			while( !GitDiagram._shape_x_less( trunk_x, branch_x ) && branch_i<branch_shape.length && GitDiagram._shape_x_eq( branch_x, branch_shape[branch_i].x ) ) {
				if( max_branch_y==null || Math.abs( branch_offset+branch_shape[branch_i].y )>Math.abs( max_branch_y ) ) {
					max_branch_y=branch_offset+branch_shape[branch_i].y;
				}
				branch_y=branch_offset+branch_shape[branch_i].y;
				++branch_i;
			}
			if( max_branch_y==null ) { // if the value has not changed - take previous one
				max_branch_y=branch_y;
			}

			var max_trunk_y=null;
			while( !GitDiagram._shape_x_less( branch_x, trunk_x ) && trunk_i<trunk_shape.length && GitDiagram._shape_x_eq( trunk_x, trunk_shape[trunk_i].x ) ) {
				if( max_trunk_y==null || Math.abs( trunk_shape[trunk_i].y )>Math.abs( max_trunk_y ) ) {
					max_trunk_y=trunk_shape[trunk_i].y;
				}
				trunk_y=trunk_shape[trunk_i].y;
				++trunk_i;
			}
			if( max_trunk_y==null ) {
				max_trunk_y=trunk_y;
			}

			if( max_branch_y==null ) {
				max_result_y=max_trunk_y;
			}else if( max_trunk_y==null ) {
				max_result_y=max_branch_y;
			}else if( Math.abs( max_branch_y )>Math.abs( max_trunk_y ) ) {
				max_result_y=max_branch_y;
			}else {
				max_result_y=max_trunk_y;
			}

			if( branch_y==null ) {
				result_y=trunk_y;
			}else if( trunk_y==null ) {
				result_y=branch_y;
			}else if( branch_i==branch_shape.length && trunk_i!=trunk_shape.length ) { // last point on the branch - the rest of result should repeat trunk
				result_y=trunk_y;
			}else if( trunk_i==trunk_shape.length && branch_i!=branch_shape.length ) { // last point on the trunk - the rest of result should repeat branch
				result_y=branch_y;
			}else {
				if( Math.abs( branch_y )>Math.abs( trunk_y ) ) {
					result_y=branch_y;
				}else {
					result_y=trunk_y;
				}
			}
		}
		if( result_y!=prev_result_y || max_result_y!=prev_result_y
		    || (trunk_i==trunk_shape.length && branch_i==branch_shape.length) ) { // always add the last point
			if( max_result_y!=result_y && max_result_y!=prev_result_y ) {
				result.push( { x: result_x, y: max_result_y } );
			}
			result.push( { x: result_x, y: result_y } );
			prev_result_y=result_y;
		}
	}
	return result;
}
GitDiagram._shape_x_less=function( x1, x2 )
{
	return x1.date<x2.date ? true
		: x2.date<x1.date ? false
		: x1.offset<x2.offset
	;
}
GitDiagram._shape_x_eq=function( x1, x2 )
{
	return x1.date==x2.date && x1.offset==x2.offset;
}
GitDiagram._shape_x_min=function( x1, x2 )
{
	return x1.date<x2.date ? x1
		: x2.date<x1.date ? x2
		: x1.offset<x2.offset ? x1
		: x2
	;
}
// might be useful for debugging
GitDiagram._shape_point_to_string=function( p )
{
	var x=p.x.date;
	if( x>10000 ) {
		var dt=new Date( x );
		var d=dt.getDate();
		var m=dt.getMonth();
		x=d+"."+(m+1);
	}
	x+="."+p.x.offset;
	return "{x: "+x+", y: "+p.y+"}";
}
GitDiagram._shape_to_string=function( shape )
{
	var s="[";
	for( var shape_i=0; shape_i<shape.length; ++shape_i ) {
		if( s.length>1 ) {
			s+=",";
		}
		s+=GitDiagram._shape_point_to_string( shape[shape_i] );
	}
	s+="]";
	return s;
}


