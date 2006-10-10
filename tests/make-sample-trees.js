
var g_start_date=new Date( 2005, 0, 5, 12, 0, 0, 0 );
function offset_to_date( days_offset, hours_offset )
{
	var msecs_per_hour=60*60*1000;
	var msecs_per_day=24*msecs_per_hour;
	var dt=g_start_date.getTime()+msecs_per_day*days_offset;
	if( hours_offset!=null ) {
		dt+=msecs_per_hour*hours_offset;
	}
	return dt;
}
function date_to_offset( date )
{
	var msecs_per_hour=60*60*1000;
	var msecs_per_day=24*msecs_per_hour;
	return (date-g_start_date.getTime()+12*msecs_per_hour)/msecs_per_day; // 12*msecs_per_hour is due to the time part of g_start_date that was stripped off in add_node
}

function make_sample_tree1( diagram )
{
	diagram.add_node( 1, offset_to_date( 3 ), null, "a", "comment #1", [2], "x" );
	diagram.add_node( 2, offset_to_date( 2 ), null, "b", "comment #2 which has an exceptionally wild length, spanning for more than 10 words", [3], "x" );
	diagram.add_node( 4, offset_to_date( 3 ), null, "c", "comment #4", [2, 8], "x" );
	diagram.add_node( 5, offset_to_date( 3 ), null, "d", "comment #5", [2], "x" );
	diagram.add_node( 6, offset_to_date( 3, 6 ), null, "a", "comment #6", [7], "x" );
	diagram.add_node( 7, offset_to_date( 2 ), null, "b", "comment #7", [8], "x" );
	diagram.add_node( 3, offset_to_date( 1 ), null, "c", "comment #3", [8], "x" );
	diagram.add_node( 8, offset_to_date( 0 ), null, "d", "comment #8", [9], "x" );
}
function make_sample_tree1a( diagram )
{
	var t;
	t=offset_to_date( 4 );
	diagram.add_node( 10, t, t, "v", "comment #10", [6], "x" );
	t=offset_to_date( 4 );
	diagram.add_node( 11, t, t, "x", "comment #11", [6], "x" );
	t=offset_to_date( 4 );
	diagram.add_node( 12, t, t, "y", "comment #12", [6], "x" );
	t=offset_to_date( 7 );
	diagram.add_node( 13, t, t, "z", "comment #13", [14], "x" );
	t=offset_to_date( 5 );
	diagram.add_node( 15, t, t, "a", "comment #15", [10], "x" );
}
function make_sample_tree2( diagram )
{
	var t;
	t=offset_to_date( 11 );
	diagram.add_node( 1, t, t, "", "", [2], "x" );
	t=offset_to_date( 9 );
	diagram.add_node( 2, t, t, "", "", [3], "x" );
	t=offset_to_date( 9 );
	diagram.add_node( 3, t, t, "", "", [4], "x" );
	t=offset_to_date( 7 );
	diagram.add_node( 4, t, t, "", "", [5], "x" );
	t=offset_to_date( 5 );
	diagram.add_node( 5, t, t, "", "", [6], "x" );
	t=offset_to_date( 3 );
	diagram.add_node( 6, t, t, "", "", [7], "x" );
	t=offset_to_date( 1 );
	diagram.add_node( 7, t, t, "", "", [100], "x" );
	t=offset_to_date( 9 );
	diagram.add_node( 8, t, t, "", "", [2], "x" );
	t=offset_to_date( 9 );
	diagram.add_node( 9, t, t, "", "", [3], "x" );
	t=offset_to_date( 8 );
	diagram.add_node( 10, t, t, "", "", [4], "x" );
	t=offset_to_date( 5 );
	diagram.add_node( 11, t, t, "", "", [5], "x" );
	t=offset_to_date( 3 );
	diagram.add_node( 12, t, t, "", "", [6], "x" );
	t=offset_to_date( 2 );
	diagram.add_node( 13, t, t, "", "", [7], "x" );
	t=offset_to_date( 2 );
	diagram.add_node( 14, t, t, "", "", [7], "x" );
	t=offset_to_date( 10 );
	diagram.add_node( 15, t, t, "", "", [13], "x" );
}
function make_sample_tree2a( diagram )
{
	for( var i=0; i<50; ++i ) {
		diagram.add_node( 16+i, offset_to_date( 12+i ), null, "", "", [16+i-1], "x" );
	}
}
function make_sample_tree2b( diagram )
{
	var i=1000;
	diagram.add_node( 1000, offset_to_date( 13+i-1000), null, "", "", [1], "x" );
	while( i<1050 ) {
		++i;
		diagram.add_node( i, offset_to_date( 13+i-1000 ), null, "", "", [i-1], "x" );
	}
}

function make_bug_tree_1( diagram )
{
	// trunk
	diagram.add_node( 0, offset_to_date( 14 ), null, "a", "0", [5550], "x" );
	diagram.add_node( 1, offset_to_date( 17 ), null, "a", "1", [0], "x" );
	diagram.add_node( 2, offset_to_date( 17 ), null, "a", "2", [1], "x" );
	diagram.add_node( 3, offset_to_date( 17 ), null, "a", "3", [2], "x" );
	diagram.add_node( 4, offset_to_date( 18 ), null, "a", "4", [3], "x" );
	diagram.add_node( 5, offset_to_date( 19 ), null, "a", "5", [4], "x" );
	diagram.add_node( 6, offset_to_date( 19 ), null, "a", "6", [5], "x" );
	diagram.add_node( 7, offset_to_date( 19 ), null, "a", "7", [6], "x" );
	diagram.add_node( 8, offset_to_date( 20 ), null, "a", "8", [7], "x" );
	
	// 17 branch
	diagram.add_node( 900, offset_to_date( 17 ), null, "a", "900", [2], "x" );
	diagram.add_node( 901, offset_to_date( 17 ), null, "a", "901", [900], "x" );
	diagram.add_node( 902, offset_to_date( 17 ), null, "a", "902", [901], "x" );
	
	// 19 branched
	diagram.add_node( 801, offset_to_date( 19 ), null, "a", "801", [6], "x" );
	diagram.add_node( 701, offset_to_date( 19 ), null, "a", "701", [6], "x" );

	
	// trunk continued
	diagram.add_node( 11, offset_to_date( 29 ), null, "a", "11", [8], "x" );
	diagram.add_node( 12, offset_to_date( 29 ), null, "a", "12", [11], "x" );
	diagram.add_node( 13, offset_to_date( 29 ), null, "a", "13", [12], "x" );
	diagram.add_node( 14, offset_to_date( 29 ), null, "a", "14", [13], "x" );
	diagram.add_node( 15, offset_to_date( 30 ), null, "a", "15", [14], "x" );
	diagram.add_node( 16, offset_to_date( 30 ), null, "a", "16", [15], "x" );
	diagram.add_node( 17, offset_to_date( 31, 5 ), null, "a", "17", [16], "x" );
	// 29, lower  branch
	diagram.add_node( 115, offset_to_date( 29 ), null, "a", "115", [14], "x" );
	diagram.add_node( 116, offset_to_date( 29 ), null, "a", "116", [115], "x" );
	// 29, upper branches
	diagram.add_node( 21, offset_to_date( 29 ), null, "a", "21", [12], "x" );
	diagram.add_node( 22, offset_to_date( 29 ), null, "a", "22", [21], "x" );
	
	diagram.add_node( 31, offset_to_date( 29 ), null, "a", "31", [12], "x" );
	diagram.add_node( 32, offset_to_date( 29 ), null, "a", "32", [31], "x" );
	
	diagram.add_node( 41, offset_to_date( 29 ), null, "a", "41", [12], "x" );
	
	diagram.add_node( 51, offset_to_date( 29 ), null, "a", "51", [12], "x" );
	diagram.add_node( 52, offset_to_date( 29 ), null, "a", "52", [51], "x" );
	
	diagram.add_node( 61, offset_to_date( 29 ), null, "a", "61", [12], "x" );

	// another trunk
	diagram.add_node( 100, offset_to_date( 28 ), null, "a", "100", [5551], "x" );
	diagram.add_node( 101, offset_to_date( 30 ), null, "a", "101", [100], "x" );
	
	// third trunk
	diagram.add_node( 200, offset_to_date( 17 ), null, "a", "200", [5552], "x" );
	diagram.add_node( 201, offset_to_date( 18 ), null, "a", "201", [200], "x" );
	diagram.add_node( 202, offset_to_date( 19 ), null, "a", "202", [201], "x" );
	diagram.add_node( 203, offset_to_date( 26 ), null, "a", "203", [202], "x" );
	
	// fourth trunk
	diagram.add_node( 300, offset_to_date( 17 ), null, "a", "300", [5552], "x" );
	diagram.add_node( 301, offset_to_date( 17 ), null, "a", "301", [300], "x" );
	diagram.add_node( 302, offset_to_date( 18 ), null, "a", "302", [301], "x" );
	diagram.add_node( 303, offset_to_date( 18 ), null, "a", "303", [302], "x" );
	
	
}
/*
	diagram.add_node( , , "", "", [] );
	diagram.add_node( , , "", "", [] );
	diagram.add_node( , , "", "", [] );
	diagram.add_node( , , "", "", [] );
	diagram.add_node( , , "", "", [] );
	diagram.add_node( , , "", "", [] );
*/

/*
	diagram.add_node( 10, "", "", "", [6] );
	diagram.add_node( 11, "", "", "", [6] );
	diagram.add_node( 12, "", "", "", [6] );
	diagram.add_node( 13, "", "", "", [14] );
	diagram.add_node( 15, "", "", "", [10] );
	diagram.add_node( 14, "", "", "", [15] );
	diagram.add_node( 16, "", "", "", [17] );
	diagram.add_node( 17, "", "", "", [15] );
	diagram.add_node( 18, "", "", "", [19] );
	diagram.add_node( 19, "", "", "", [15] );
	diagram.add_node( 20, "", "", "", [21] );
	diagram.add_node( 22, "", "", "", [21] );
	diagram.add_node( 23, "", "", "", [12] );
	diagram.add_node( 21, "", "", "", [23] );
	diagram.add_node( 24, "", "", "", [25] );
	diagram.add_node( 26, "", "", "", [25] );
	diagram.add_node( 25, "", "", "", [23] );
	diagram.add_node( 29, "", "", "", [28] );
	diagram.add_node( 27, "", "", "", [28] );
	diagram.add_node( 28, "", "", "", [23] );
*/
