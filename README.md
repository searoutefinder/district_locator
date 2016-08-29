# School district locator
School district locator application based on CartoDB

Instructions on how to use this locator<br/>
     - Create a free account at http://carto.com first! This will be the pool where the application's geodata will be hosted.<br/>
     - Then grab the carto username and the table names for elementary-, middle- and highschools and insert the table names to their appropriate place in <strong>modules/map.js</strong><br/>
     - Place the code on your web server and enjoy!<br/><br/>
     Setup example:<br/>
     <pre>
         	var _config = {
	            "layers": {
		              "schools":{
			                "high": "<strong>highschool_table_name_here</strong>",
				              "middle": "<strong>middleschool_table_name_here</strong>",
				              "elementary": "<strong>elementaryschool_table_name_here</strong>",
				              "school_locations": "<strong>schools_locations_table_name_here</strong>"
			            },
			           "addresses": {
			                "address_lookup_table": "<strong>address_points_table_name_here</strong>"
			            }
		          }
	       };
     </pre><br/>
     
