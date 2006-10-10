/*
Copyright (C) 2005, Artem Khodush <greenkaa@gmail.com>

This file is licensed under the GNU General Public License version 2.
*/

if( typeof( GitBrowser )=="undefined" ) {
	GitBrowser={};
}

if( typeof( InvisibleRequest )=="undefined" ) {
	alert( "javascript file is omitted (InvisibleRequest.js) - this page will not work properly" );
}

// call_server
GitBrowser.set_error_handler=function( handler )
{
	GitBrowser._user_error_handler=handler;
}
GitBrowser._user_error_handler=function( msg )
{
	alert( msg );
}
GitBrowser._error_handler=function( msg, arg )
{
	GitBrowser._user_error_handler( msg );
	if( arg!=null ) {
		++arg.chain_i;
		GitBrowser._next_call_server( arg );
	}else {
		arg.final_handler( arg.final_handler_arg );
	}
}
GitBrowser._server_handler=function( doc, arg )
{
	if( doc.error!=null ) {
		GitBrowser._error_handler( doc.error, arg );
	}else {
		arg.handler( doc.result, arg.chain[arg.chain_i].handler_arg );
		++arg.chain_i;
		GitBrowser._next_call_server( arg );
	}
}
GitBrowser._g_server_url="git-browser.pl";
GitBrowser._g_server_timeout_seconds=132;
GitBrowser._make_server_url=function( arg )
{
	var url=GitBrowser._g_server_url+"?";
	url+="sub="+encodeURIComponent( arg.sub );
	if( arg.repo!=null ) {
		url+="&repo="+encodeURIComponent( arg.repo );
	}
	if( arg.sub_args!=null ) {
		var sub_arg_name;
		for( sub_arg_name in arg.sub_args ) {
			var sub_arg=arg.sub_args[sub_arg_name];
			for( var sub_i=0; sub_i<sub_arg.length; ++sub_i ) {
				var value=sub_arg[sub_i];
				if( value!=null && !value.match( /^\s*$/ ) ) {
					url+="&"+sub_arg_name+"="+encodeURIComponent( value );
				}
			}
		}
	}
	return url;
}
GitBrowser._next_call_server=function( arg )
{
	if( arg.chain_i<arg.chain.length ) {
		if( arg.before_handler!=null ) {
			arg.before_handler( arg.chain[arg.chain_i].handler_arg );
		}
		InvisibleRequest.get( { url: GitBrowser._make_server_url( arg.chain[arg.chain_i] ),
					handler: GitBrowser._server_handler,
					handler_arg: arg,
					error_handler: GitBrowser._error_handler,
					timeout_seconds: GitBrowser._g_server_timeout_seconds
		} );
	}else {
		arg.final_handler( arg.final_handler_arg );
	}
}
// handler: handler
// before_handler: called before each server request
// final_handler: called when all requests are finished
// final_handler_arg: the only argument to the previous
// chain: array of { sub: repo: handler_arg: sub_args: }. if null, its assumed to be the one-element chain with the following items specified directly:
// sub: sub_name
// repo: repo_name (optional)
// handler_arg: second argument for handler
// sub_args: [array of sub arguments]
GitBrowser.call_server=function( arg )
{
	var chain=arg.chain;
	if( chain==null ) {
		chain=[ { sub: arg.sub, repo: arg.repo, handler_arg: arg.handler_arg, sub_args: arg.sub_args } ];
	}
	GitBrowser._next_call_server( { chain: chain, chain_i: 0, handler: arg.handler, before_handler: arg.before_handler, final_handler: arg.final_handler, final_handler_arg: arg.final_handler_arg } );
}


// status_show, error_show
GitBrowser._g_status_div=null;
GitBrowser._g_error_div=null;

GitBrowser.setup_status_error=function()
{
	var status=document.createElement( "DIV" );
	status.style.display="none";
	status.style.position="absolute";
	status.style.top="0";
	status.style.right="3em";
	status.style.fontSize="10pt";
	status.style.paddingTop="2px";
	status.style.paddingBottom="2px";
	status.style.paddingLeft="5px";
	status.style.paddingRight="5px";
	status.style.color="#ffffff";
	status.style.backgroundColor="#090";
	document.body.appendChild( status );
	GitBrowser._g_status_div=status;
	var error=document.createElement( "DIV" );
	var error_close=document.createElement( "SPAN" );
	error_close.appendChild( document.createTextNode( "close" ) );
	error.appendChild( error_close );
	error.appendChild( document.createElement( "SPAN" ) );
	error.style.display="none";
	error.style.border="1px solid #a00";
	error.style.color="#800";
	error.style.backgroundColor="#ffffff";
	error.style.paddingTop="3px";
	error.style.paddingBottom="3px";
	error.style.paddingLeft="5px";
	error.style.paddingRight="5px";
	error.style.position="absolute";
	error.style.top="3px";
	error.style.left="3px";
	error.style.zIndex="10";
	error_close.style.color="#ffffff";
	error_close.style.backgroundColor="#a22";
	error_close.style.marginTop="3px";
	error_close.style.marginBottom="3px";
	error_close.style.marginLeft="1em";
	error_close.style.marginRight="5px";
	error_close.style.paddingTop="0";
	error_close.style.paddingBottom="0";
	error_close.style.paddingLeft="3px";
	error_close.style.paddingRight="3px";
	error_close.style.cursor="pointer";
	error_close.onclick=GitBrowser.error_close;
	document.body.appendChild( error );
	GitBrowser._g_error_div=error;
	GitBrowser.set_error_handler( GitBrowser.error_show );
}
GitBrowser.status_show=function( msg )
{
	if( GitBrowser._g_status_div!=null ) {
		if( msg!=null && msg!="" ) {
			GitBrowser._g_status_div.innerHTML="";
			GitBrowser._g_status_div.appendChild( document.createTextNode( msg ) );
			GitBrowser._g_status_div.style.display="block";
		}else {
			GitBrowser._g_status_div.style.display="none";
		}
	}
}
GitBrowser.error_show=function( msg )
{
	GitBrowser.status_show();
	GitBrowser._g_error_div.lastChild.innerHTML="";
	GitBrowser._g_error_div.lastChild.appendChild( document.createTextNode( "Error: "+msg ) );
	GitBrowser._g_error_div.style.display="block";
}
GitBrowser.error_close=function()
{
	GitBrowser._g_error_div.style.display="none";
}

// decode / encode selected repositories and refs as url parameters / text description
// repos={ repo_name => { all_heads: boolean, heads: [strings], tags: [strings] } }
GitBrowser.repos_decode_location=function( location )
{
	var repos={};
	var args=location.search;
	if( args.charAt( 0 )=="?" ) {
		args=args.slice( 1 );
	}
	if( args.length>0 ) {
		args=args.split( "&" );
		for( var arg_i=0; arg_i<args.length; ++arg_i ) {
			var arg=args[arg_i].split( "=" );
			if( arg[0]=="r" ) {
				var repo_name=arg[1];
				if( repos[repo_name]==null ) {
					repos[repo_name]={ heads: [], tags: [] };
				}
				repos[repo_name].all_heads=true;
			}else if( arg[0]=="h" || arg[0]=="t" ) {
				var ref=arg[1].split( "," );
				var repo_name=ref[0];
				var ref_name=ref[1];
				if( repos[repo_name]==null ) {
					repos[repo_name]={ heads: [], tags: [] };
				}
				if( arg[0]=="h" ) {
					repos[repo_name].heads.push( ref_name );
				}else {
					repos[repo_name].tags.push( ref_name );
				}
			}
		}
	}
	return repos;
}
GitBrowser.repos_encode_url_param=function( repos )
{
	var params=[];
	for( var repo_name in repos ) {
		var repo=repos[repo_name];
		if( repo.all_heads ) {
			params.push( "r="+encodeURIComponent( repo_name ) );
		}
		for( var head_i=0; head_i<repo.heads.length; ++head_i ) {
			params.push( "h="+encodeURIComponent( repo_name )+","+encodeURIComponent( repo.heads[head_i] ) );
		}
		for( var tag_i=0; tag_i<repo.tags.length; ++tag_i ) {
			params.push( "t="+encodeURIComponent( repo_name )+","+encodeURIComponent( repo.tags[tag_i] ) );
		}
	}
	return params.join( "&" );
}
GitBrowser.repos_encode_text=function( repos )
{
	var text=[];
	for( var repo_name in repos ) {
		var repo=repos[repo_name];
		if( repo.all_heads ) {
			text.push( "all "+repo_name+" heads" );
		}
		if( repo.heads.length>0 ) {
			text.push( repo_name+" heads: "+repo.heads.join( " " ) );
		}
		if( repo.tags.length>0 ) {
			text.push( repo_name+" tags: "+repo.tags.join( " " ) );
		}
	}
	return text.join( "; " );
}

// filter dialog.
// global vars:
// dialog: HTML filter div element
// x, y: filter dialog absolute pos
// apply_handler: called when "reload" filter button is clicked. argument: { exclude_commits: [], paths: [] }
// apply_handler_context: second argument to apply_handler
// exclude_edit: HTML edit element for commits to exclude
// paths_edit: HTML edit element for paths to limit git-rev-list output
GitBrowser._g_filter={};

GitBrowser._filter_dialog_close=function()
{
	GitBrowser._g_filter.dialog.style.display="none";
}
GitBrowser._filter_dialog_apply=function()
{
	var exclude_commits=GitBrowser._g_filter.exclude_edit.value.split( " " );
	var paths=GitBrowser._g_filter.paths_edit.value.split( " " );
	GitBrowser._g_filter.dialog.style.display="none";
	GitBrowser._g_filter.apply_handler( { exclude_commits: exclude_commits, paths: paths }, GitBrowser._g_filter.apply_handler_context );
}
GitBrowser._filter_dialog_clear=function()
{
	GitBrowser._g_filter.exclude_edit.value="";
	GitBrowser._g_filter.paths_edit.value="";
}
GitBrowser._filter_dialog_show=function()
{
	if( GitBrowser._g_filter.dialog.style.display=="none" ) {
		GitBrowser._g_filter.dialog.style.display="";
		var y=GitBrowser._g_filter.y;
		if( y>500 ) { // XXX it's random
			y-=GitBrowser._g_filter.dialog.clientHeight;
		}
		Motion.set_page_coords( GitBrowser._g_filter.dialog, GitBrowser._g_filter.x, y );
	}else {
		GitBrowser._g_filter.dialog.style.display="none";
	}
}
GitBrowser._filter_dialog_loaded=function( template, arg )
{
	var data={
		filterdialog: {
			_process: function( n ) { GitBrowser._g_filter.dialog=n; },
			filtertable: {
				filterexclude: { _process: function( n ) { GitBrowser._g_filter.exclude_edit=n; } },
				filterpath: { _process: function( n ) { GitBrowser._g_filter.paths_edit=n; } }
			},
			filterreload: { _process: function( n ) { n.onclick=GitBrowser._filter_dialog_apply; n.href="#"; } },
			filterclear: { _process: function( n ) { n.onclick=GitBrowser._filter_dialog_clear; n.href="#"; } },
			filterclose: { _process: function( n ) { n.onclick=GitBrowser._filter_dialog_close; n.href="#"; } }
		}
	};
	DomTemplate.apply( template, data, document.body );
	GitBrowser._g_filter.x=arg.x;
	GitBrowser._g_filter.y=arg.y;
	GitBrowser._g_filter.apply_handler=arg.apply_handler;
	GitBrowser._g_filter.apply_handler_context=arg.apply_handler_context;
	arg.show_button.onclick=GitBrowser._filter_dialog_show;
}
// arg:
// 	show_button: its onclick will show filter
// 	x, y: filter dialog pos
// 	apply_handler: called when "reload" filter button is clicked. argument: { exclude_commits: [], paths: [] }
GitBrowser.filter_dialog_init=function( arg )
{
	InvisibleRequest.get_element( { url: "templates.html", element_id: "filterdialogtemplate",
					handler: GitBrowser._filter_dialog_loaded, handler_arg: arg,
					error_handler: GitBrowser.error_show } );
}


// title
GitBrowser._g_title={};
GitBrowser._title_loaded=function( template, arg )
{
	var selected_text=GitBrowser.repos_encode_text( arg.repos );
	if( selected_text=="" ) {
		selected_text="none selected";
	}
	var data={
		title: {
			_process: function( n ) { arg.title_div=n; },
			selectedtext: selected_text,
			selectother: { _process: function( n ) { arg.select_other_btn=n } },
			commitcount: { _process: function( n ) { GitBrowser._g_title.commitcount=n; } },
			loadmore: { _process: function( n, context ) { GitBrowser._g_title.loadmore=n; arg.load_more_button_init( n ); }, _process_arg: arg },
			filtershow: { _process: function( n, context ) { n.href="#"; arg.filter_button_init( n, context ); }, _process_arg: arg }
		}
	};
	DomTemplate.apply( template, data, document.body );
	if( arg.title_loaded_handler!=null ) {
		arg.title_loaded_handler( arg );
	}
	arg.exclude_commits=[];
	arg.paths=[];
	GitBrowser.commits_load_first( arg );
}

// arg:
// 	load_more_button_init: function( b )
// 	filter_button_init: function( b )
//	title_loaded_handler: called when the title is loaded into the document, takes title_div as an argument
//	commits_first_loaded_handler: function( context )
//	commits_more_loaded_handler: function( context )
//	context: {
//		diagram: GitDiagram object
//		diagram_div:
//		repos: as returned by repos_decode_location
//		(assigned later)
//		title_div:
//		exclude_commits: []
//		paths: []
//	}
GitBrowser.title_init=function( arg )
{
	InvisibleRequest.get_element( { url: "templates.html", element_id: "titletemplate",
					handler: GitBrowser._title_loaded, handler_arg: arg,
					error_handler: GitBrowser.error_show } );
}
//arg:
// 	diagram: diagram
GitBrowser.title_update=function( arg )
{
	GitBrowser._g_title.commitcount.innerHTML="";
	GitBrowser._g_title.commitcount.appendChild( document.createTextNode( "Loaded "+arg.diagram.get_commit_count()+" commits " ) );
	var need_more=arg.diagram.get_start_more_ids().length!=0;
	GitBrowser._g_title.loadmore.style.visibility= need_more ? "visible" : "hidden";
}

// diagram loading (calls only add_node)
GitBrowser._add_refs_and_commits=function( data, arg )
{
	for( var i=0; i<data.refs.length; ++i ) {
		arg.diagram.add_label( data.refs[i].id, data.refs[i].name, arg.repo_name, data.refs[i].type );
	}
	GitBrowser._add_commits( data.commits, arg );
}
GitBrowser._add_commits=function( commits, arg )
{
	var tmp=[];
	for( var commit_id in commits ) {
		tmp.push( commit_id );
	}
	tmp.sort();
	for( var tmp_i=0; tmp_i<tmp.length; ++tmp_i ) {
		var commit=commits[tmp[tmp_i]];
		if( (commit.committer_epoch!=null || commit.author_epoch!=null) && commit.id!=null && commit.author!=null && commit.parents!=null ) {
			var committer_time=commit.committer_epoch==null ? null : commit.committer_epoch*1000;
			var author_time=commit.author_epoch==null ? null : commit.author_epoch*1000;
			var comment=commit.comment==null ? "" : commit.comment.join( "  " );
			arg.diagram.add_node( commit.id, committer_time, author_time, commit.author, comment, commit.parents, arg.repo_name );
		}
	}
}
// arg:
// 	repos: as returned by repos_decode_location
// 	diagram: diagram
// 	exclude_commits: [], as passed to apply_handler first arg in filter_dialog
// 	paths: [], as passed to apply_handler first arg in filter_dialog
// 	commits_first_loaded_handler: function( arg )
GitBrowser.commits_load_first=function( arg )
{
	var chain=[];
	for( var repo_name in arg.repos ) {
		var repo=arg.repos[repo_name];
		var refs=[];
		if( repo.all_heads ) {
			refs.push( "r,all" );
		}
		for( var head_i=0; head_i<repo.heads.length; ++head_i ) {
			refs.push( "h,"+repo.heads[head_i] );
		}
		for( var tag_i=0; tag_i<repo.tags.length; ++tag_i ) {
			refs.push( "t,"+repo.tags[tag_i] );
		}
		refs.sort();
		chain.push( { sub: "commits_from_refs", repo: repo_name, handler_arg: { diagram: arg.diagram, repo_name: repo_name },
					sub_args: { ref: refs, x: arg.exclude_commits, path: arg.paths, shortcomment: [arg.shortcomment] }
			} );
	}

	GitBrowser.status_show( "loading..." );
	GitBrowser.call_server( { handler: GitBrowser._add_refs_and_commits,
					final_handler: function( arg ) { GitBrowser.status_show( "" ); arg.commits_first_loaded_handler( arg ); }, final_handler_arg: arg,
					chain: chain } );
}
// arg:
// 	diagram: diagram
// 	exclude_commits: [], as passed to apply_handler first arg in filter_dialog
// 	paths: [], as passed to apply_handler first arg in filter_dialog
// 	commits_more_loaded_handler: function( arg )
GitBrowser.commits_load_more=function( arg )
{
	var repo_map={};
	var more_ids=arg.diagram.get_start_more_ids();
	for( var i=0; i<more_ids.length; ++i ) {
		var id=more_ids[i];
		for( var repo_i=0; repo_i<id.repos.length; ++repo_i ) {
			var repo_name=id.repos[repo_i];
			if( repo_map[repo_name]==null ) {
				repo_map[repo_name]=[[]];
			}
			var ids=repo_map[repo_name][repo_map[repo_name].length-1];
			if( ids.length>9 ) { // split to avoid too long urls - for now, the limit is 10 40-byte ids per url.
						// since server does not keep track which commits were already sent to which client,
						// splitting requests may cause redundant data to be transferred.
				repo_map[repo_name].push( [] );
				ids=repo_map[repo_name][repo_map[repo_name].length-1];
			}
			ids.push( id.id );
		}
	}
	var chain=[];
	for( var repo_name in repo_map ) {
		var ids_a=repo_map[repo_name];
		for( var i=0; i<ids_a.length; ++i ) {
			var ids=ids_a[i];
			ids.sort();
			chain.push( { sub: "commits_from_ids", repo: repo_name, handler_arg: { diagram: arg.diagram, repo_name: repo_name },
					sub_args: { id: ids, x: arg.exclude_commits, path: arg.paths, shortcomment: [arg.shortcomment] }
				} );
		}
	}
	GitBrowser.status_show( "loading..." );
	GitBrowser.call_server( { handler: GitBrowser._add_commits,
						final_handler: function( arg ) { GitBrowser.status_show( "" ); arg.commits_more_loaded_handler( arg ); }, final_handler_arg: arg,
						chain: chain } );
}

// glue code that appears to be common between by-date.html and by-commits.html
// diagram ui handler. first argument should be ui handlers map: event_name=>handler
GitBrowser.diagram_ui_handler=function()
{
	var ui_map=arguments[0];
	var event_name=arguments[1];
	var args=[];
	for( var i=2; i<arguments.length; ++i ) {
		args.push(arguments[i] );
	}
	var handler=ui_map[event_name];
	if( handler!=null ) {
		handler.apply( this, args );
	}
}
// filter
GitBrowser.filter_dialog_handler=function( arg, context )
{
	context.exclude_commits=arg.exclude_commits;
	context.paths=arg.paths;
	context.diagram.clear();
	GitBrowser.commits_load_first( context );
}
GitBrowser.filter_dialog_create=function( filter_button, context )
{
	var ref_pos=Motion.get_page_coords( filter_button );
	var x=ref_pos.x+filter_button.clientWidth;
	var y=ref_pos.y+2+filter_button.scrollHeight;
	GitBrowser.filter_dialog_init( { show_button: filter_button, x: x, y: y, apply_handler: GitBrowser.filter_dialog_handler, apply_handler_context: context } );
}

// arg:
//	repos: as as returned by repos_decode_location
//	diagram: GitDiagram object
//	title_loaded_handler
//	commits_first_loaded_handler
//	commits_more_loaded_handler
GitBrowser.init=function( arg )
{
	GitBrowser.setup_status_error();
	arg.load_more_button_init=function( b ) { b.href="#"; b.onclick=function() { GitBrowser.commits_load_more( arg ) }; };
	arg.filter_button_init=GitBrowser.filter_dialog_create;
	GitBrowser.title_init( arg );
}
