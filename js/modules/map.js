/**
 * @license
 * Copyright (c) 2016 Tamas Hajdu - EzMapDesign Ltd.
 */
var mapModule = (function(window,$){

    var _vars = {
	    "map": null,
		"sql": null,
		"selectedType": null,
		"layers": null,
		"marker": null,
		"mainControl": null
	};
	
	/*
	 *
	 *	HINT
	 *  Edit the configuration below to use data from your latest cartoDB tables
	 *  layers.schools contains the table names to elementary-, middle- and highschools
	 *  while addresses.address_lookup_table contains the table name to the address lookup table
	 *
	 */
	
	var _config = {
	    "cartouser": "your-carto-username-comes-here",
	    "layers": {
		    "schools":{
			    "high": "school_high_area",
				"middle": "school_middle_area",
				"elementary": "scenario_a_territories_082416",
				"school_locations": "schools_wentzville"
			},
			"addresses": {
			    "address_lookup_table": "address_points"
			}
		}
	};

	/*
	 *	----------------------------------------- DO NOT EDIT BELOW THIS LINE!	-----------------------------------------
	 */
	
    function _init(){
		_vars.sql = cartodb.SQL({ user: _config['cartouser'] });
		_vars.selectedType = "elementary";
		_vars.layers = {
			"schools": []
		};
		_vars.map = new google.maps.Map(document.getElementById("map-canvas"), {
		    center: new google.maps.LatLng(38.829954,-90.869979),
			mapTypeId: google.maps.MapTypeId.ROADMAP,
			mapTypeControl: true,
            mapTypeControlOptions: {
			    position: google.maps.ControlPosition.BOTTOM_CENTER
            },
		    zoom:11
		});
		_vars.marker = new google.maps.Marker({"icon": "img/star.png", "title": "Your address"});
		
		_loadAreas();
		_plotSchools();
		
		_vars.mainControl = $($("#map_menu_control").html());				
		_vars.map.controls[google.maps.ControlPosition.TOP_CENTER].push(_vars.mainControl.get(0));		
		
		google.maps.event.addListenerOnce(_vars.map, 'idle', function() {
		    _doOnIdle();
		});
	}
	
	function _returnSchoolTypeTableName(type){
		switch(_vars.selectedType){
		    case "elementary":
			    return _config.layers.schools.elementary;
			break;
			case "middle":
			    return _config.layers.schools.middle;
			break;
			case "high":
			    return _config.layers.schools.high;
			break;
		}	
	}
	
	function _loadAreas(){
	    $(".loading").show();
		
	    _vars.sql.execute("SELECT ST_AsGeoJson(the_geom) AS geom, color, school_nam, school_dis FROM " + _returnSchoolTypeTableName(_vars.selectedType) +" WHERE school_dis='Wentzville'").done(function(data) {				
			_removeAllAreas();
							
			var ftrCollection = {"type": "FeatureCollection", "features": []};
			if(data.rows.length>0){
				for(i=0;i<data.rows.length;i++){
					ftrCollection.features.push({"type": "Feature", "properties": {"color": data.rows[i]["color"], "name": data.rows[i]["school_nam"], "district": data.rows[i]["school_dis"]}, "geometry": JSON.parse(data.rows[i]["geom"])});
				}
			}
					
			_vars.map.data.addGeoJson(ftrCollection);
							
		    _vars.map.data.setStyle(function(feature){
			    if(typeof feature.getProperty("color") != undefined){
			        return ({"fillColor": feature.getProperty("color"),"strokeColor": "#000000", "fillOpacity": 0.5, "strokeOpacity": 1,"strokeWeight": 0.5});		
			    }			
		    });							
							
		    $(".loading").hide();
		});			
    }	

	function _plotSchools(){
        $(".loading").show();
		_vars.sql.execute("SELECT address, city, name, principal, schemail, state, teachers, type, ST_X(the_geom) AS lng, ST_Y(the_geom) AS lat FROM " + _config.layers.schools.school_locations + " WHERE type ILIKE '%" + _vars.selectedType + "%'").done(function(data) {
				    
			while(_vars.layers["schools"][0]){
			    _vars.layers["schools"].pop().setMap(null);
			}
			_vars.layers["schools"].length = 0;
					
		    if(data.rows.length>0){
			    for(i=0;i<data.rows.length;i++){
				    var schoolMarker = new google.maps.Marker({
						"map": _vars.map,
						"icon": "img/school.png",
                        "title": data.rows[i]["name"],								
						"position": new google.maps.LatLng(parseFloat(data.rows[i]["lat"]), parseFloat(data.rows[i]["lng"])),
						"properties": {"lat": data.rows[i]["lat"], "lng": data.rows[i]["lng"], "address": data.rows[i]["address"], "city": data.rows[i]["city"], "name": data.rows[i]["name"], "principal": data.rows[i]["properties"], "email": data.rows[i]["schemail"], "state": data.rows[i]["state"], "teacherscount": data.rows[i]["teachers"], "schooltype": data.rows[i]["type"]}
					});
					_createCallout(schoolMarker);
					_vars.layers["schools"].push(schoolMarker);
				}
				$(".loading").hide();
			}
			else
			{
			    $(".loading").hide();
			}
		});
	}

    function _plotMarker(id){
		_vars.sql.execute("select ST_X(the_geom) AS lng, ST_Y(the_geom) AS lat FROM " + _config.layers.addresses.address_lookup_table + " WHERE objectid = '" + id + "'").done(function(data) {
		    if(data.rows.length>0){
			    console.log(data.rows);
				_vars.marker.setMap(_vars.map);
				_vars.marker.setPosition(new google.maps.LatLng(parseFloat(data.rows[0]["lat"]), parseFloat(data.rows[0]["lng"])));
				_vars.map.setCenter(_vars.marker.getPosition());
				_vars.map.setZoom(14);
						
				//Perform point in polygon db search				        
                _detectSchool(_vars.marker.getPosition());
		    }
		});
	}	
	
	function _detectSchool(latlng){
		_vars.sql.execute("SELECT color, school_nam, school_dis, type, ST_AsGeoJson(the_geom) AS geom FROM " + _returnSchoolTypeTableName(_vars.selectedType) + " WHERE school_dis='Wentzville' AND ST_Intersects(the_geom, ST_SetSRID(ST_MakePoint(" + latlng.lng() + "," + latlng.lat() + "),4326))").done(function(data) {			   				
			_removeAllAreas();
								
			var ftrCollection = {"type": "FeatureCollection", "features": []};
						
			if(data.rows.length>0){
				var msg = $("#msg-dismissible").html();
				$("#msg-container").html(Mustache.render(msg, {"type": _vars.selectedType, "school": data.rows[0]["school_nam"]})).fadeIn();
				$("#msg-container").find(".alert").on("close.bs.alert", function(){
					$("#msg-container").fadeOut();
					_vars.marker.setMap(null);
					_loadAreas();
					_plotSchools();
				});
							
				for(i=0;i<data.rows.length;i++){
					ftrCollection.features.push({"type": "Feature", "properties": {"color": data.rows[i]["color"], "name": data.rows[i]["school_nam"], "district": data.rows[i]["school_dis"]}, "geometry": JSON.parse(data.rows[i]["geom"])});
				}
							
				_vars.map.data.addGeoJson(ftrCollection);
								
				_vars.map.data.setStyle(function(feature){
					if(typeof feature.getProperty("color") != undefined){
						return ({"fillColor": feature.getProperty("color"),"strokeColor": "#000000", "fillOpacity": 0.5, "strokeOpacity": 1,"strokeWeight": 0.5});		
					}			
				});	

				_filterSchools(data.rows[0]["school_nam"]);
			}
			else
			{
				var msg = $("#msg-error-dismissible").html();
				$("#msg-container").html(Mustache.render(msg, {"address": $("#inp_address").val()})).fadeIn();
				$("#msg-container").find(".alert").on("close.bs.alert", function(){
					$("#msg-container").fadeOut();
					_vars.marker.setMap(null);
					_loadAreas();
				});				
			}					
	    });				
    }	

	function _filterSchools(schoolName){
        for(i=0;i<_vars.layers["schools"].length;i++){
		    if(_vars.layers["schools"][i]["properties"]["name"].toLowerCase().indexOf(schoolName.toLowerCase()) > -1){
			    _vars.layers["schools"][i].setMap(_vars.map);						
			}
		    else
		    {
			    _vars.layers["schools"][i].setMap(null);
		    }
		}
	}	

	function _removeAllAreas(){
	    //Clear all areas displayed on the data layer
		_vars.map.data.forEach(function(feature) {        
            _vars.map.data.remove(feature);
        });
		//Detaching all events that was attached earlier to the data layer
		google.maps.event.clearListeners(_vars.map.data, 'click');
	}	

	function _createCallout(markerObj){
	    google.maps.event.addListener(markerObj, "click", function(){
		    var content = Mustache.render($("#school_callout").html(), markerObj.properties);
			$('#messageModal').html(content);
			$('#messageModal').modal({"show": true});
			$('#messageModal').on("shown.bs.modal", function(){
						
			});
		});
	}
	
	function _doOnIdle(){
		$('#messageModal').html($("#explanation_screen").html());
		$('#messageModal').modal({"show": true});				
				
		$('#inp_address').on('keypress', function(e) {
			if ($(e.target).val().length > 2) {
				$(".btn-load-indicator").show();
				_vars.sql.execute("select str_add,objectid FROM " + _config.layers.addresses.address_lookup_table + " WHERE str_add ILIKE '%" + $(e.target).val() + "%' LIMIT 10").done(function(data) {
					if(data.rows.length>0){
						$("#suggestresults").html("");
						for(i=0;i<data.rows.length;i++){
							var item = $('<li data-id="' + data.rows[i]["objectid"] + '">' + data.rows[i]["str_add"] + '</li>');
							item.on("click", function(e){								   
								$("#inp_address").val($(this).html());
								$("#suggestresults").hide();
								_plotMarker($(this).data("id"));																			
							});
							$("#suggestresults").append(item);
						}
						$(".btn-load-indicator").hide();
						$("#suggestresults").show();								
					}
				});
			}	
		});
		$('#inp_address').on("click", function(){
			$(this).val("");
		});	

		$("#btn_help").on("click", function(){
			$('#messageModal').html($("#explanation_screen").html());
		    $('#messageModal').modal({"show": true});					
		});				
				
		//Switch type selector on and off
        $("#btn-typeselector-toggle").on("click", function(){
			if($(".mapmenu-typeselector-container").is(":visible")){
			    $(".mapmenu-typeselector-container").fadeOut();
				$("#btn-typeselector-toggle > i").toggleClass("fa-times");
				$("#btn-typeselector-toggle > i").toggleClass("fa-bars");
			}
			else
			{
			    $(".mapmenu-typeselector-container").fadeIn();
				$("#btn-typeselector-toggle > i").toggleClass("fa-bars");
				$("#btn-typeselector-toggle > i").toggleClass("fa-times");
			}
		});
				
		var selectorButtons = [$("#btn-opt-elem"), $("#btn-opt-middle"), $("#btn-opt-high")];
				
		$.each(selectorButtons, function(index, elem){
			elem.on("click", function(){
				//Remove active class from all elements
				$.each(selectorButtons, function(i, e){
					e.removeClass("active");
				});
				elem.toggleClass("active");
				_vars.selectedType = elem.data("name");
						
				//Display areas and schools based on user selection
				//Query cartoDB and append results to google map's data layer					
                _loadAreas();
				_plotSchools();
						
				//If the marker has an address, then do...
				if(_vars.marker.getMap() == _vars.map){
					_detectSchool(_vars.marker.getPosition());
				}
				else
				{
				    _loadAreas();
				}
						
			});
		});	
	}
	
	return {
		init: _init
	};

})(window,jQuery);            
