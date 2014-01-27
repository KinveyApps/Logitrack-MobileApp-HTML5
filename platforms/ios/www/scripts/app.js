/**
 * Copyright 2013 Kinvey, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* global $: true, Kinvey: true */
(function() {
  'use strict';

  // Setup.
  // ------

  // Initialize Kinvey.
  var promise = Kinvey.init({
    appKey    : 'kid_VTpS9qbe7q',
    appSecret : '5ae17c3bd8414d7f917c59a1c14a8fcd',
    sync      : {
      enable : true,
      online : navigator.onLine
    }
  });
  promise.then(function(activeUser) {
    // Preload templates.
    if(null === activeUser) {
      return Kinvey.User.create();
    }
  }).then(function(){
	$.when([
		$.Mustache.load('templates/search.html'),
		$.Mustache.load('templates/checkins.html')
	
	]).then(function(){
		$.mobile.initializePage();// Render page.	
	});
  }, function(){alert('cant connect to server');});

  // On/offline hooks.
  $(window).on({
    offline : Kinvey.Sync.offline,
    online  : function() {
      // Some browsers fire the online event before the connection is available
      // again, so set a timeout here.
      setTimeout(function() {
        Kinvey.Sync.online();
      }, 10000);
    }
  });
  

  // Default mustache data filters.
  var mustacheData = {
    self: function() {
      return this.author._id === Kinvey.getActiveUser()._id ||
       (null != this.recipient && this.recipient._id === Kinvey.getActiveUser()._id);
    },
    date: function() {
      return new Date(this._kmd.lmt).toUTCString();
    },
    isSelect : function(){
    	return this.type == "select";
    },
    isCheckbox : function(){
    	return this.type == 'checkbox';
    }
  };

  
  // Home.
  // -----
  var home = $('#home');
  home.on({
    /**
     * Init hook.
     */
    pageinit: function() {
      
      home.on('click', '#save', function() {
        var button = $(this).addClass('ui-disabled');
        //TODO: data search
		Kinvey.DataStore.find('route', null,{
			success : function(data){
				if (data.length == 0){
					alert("No route found");
				} else {
					route.userRoute = data[0];
					button.removeClass('ui-disabled');
					$.mobile.changePage(route);
					
				}
			}
		});
		
        
      });
    },

    /**
     * Before show hook.
     */
    pagebeforeshow: function() {
      Kinvey.DataStore.find('search-options', null, {
    	success : function(response) {
    		window.searchOptions = response;
    		for (var i in response){
    			if (response[i].values){
    				var values = response[i].values;
    				var array = [];
    				for (var j in values){
    					array[array.length] = {'name':j, 'value' : values[j]};
    				}
    				response[i].values = array;
    			}
    		}
    		home.find('.search_form').mustache('search', $.extend({ searchOptions: window.searchOptions }, mustacheData), {method : 'html'}).listview('refresh');
    		home.find("select").each(function(){
    			if($(this).data('role') == 'slider'){
    				$(this).slider().slider('refresh');
    			} else {
    				$(this).selectmenu().selectmenu('refresh');
    			}
    		});
    	}
      });
      
    }
  });

  // maps.
  // --------
  var route   = $('#route');
  route.on({
  	pageinit : function(){
  		
		route.on('swipeup',"#sliderOpen", function(){
			if(!route.sliderOpened){
				$("#pauseRoute").show().height(0);
				$("#pauseRoute").animate({
					height: route.contentHeight
				});
				$("#sliderOpen").text("Slide down to resume route");
				route.sliderOpened = true;
			}
		});
		
		route.on('swipedown', "#sliderOpen", function(){
			if (route.sliderOpened){
				$("#sliderOpen").text("Slide up to pause route");
				route.sliderOpened = false;
				$("#pauseRoute").animate({
					height: 0
				});
			}
		});
		
		route.on("click", "#checkin_btn", function(){
			var button = $(this).addClass('ui-disabled');
			if (!checkins.kinveyData){
				Kinvey.DataStore.find('checkins', null, {
			    	success : function(response) {
			    		checkins.kinveyData = response;
			    		$.mobile.changePage(checkins);	
			    	}
			      });
			}else {
				$.mobile.changePage(checkins);	
			}
			
			var button = $(this).removeClass('ui-disabled');
			
		});
		
		route.on("click", "#my_loc", function(){
			$(this).toggleClass("enabled");
			route.followUser = $(this).hasClass("enabled");
			
				//$(this).css("background-image", route.followUser ? "url:(../images/myl_normal.png)": "url:(../images/myl_disabled.png)")
			
		})
		
  	},
  	pageshow : function() {
		var the_height = ($(window).height() - $(this).find('[data-role="header"]').height() - $(this).find('[data-role="footer"]').height()) - 36;
  		route.contentHeight = the_height;
		
    	$(this).find('[data-role="content"]').height(the_height);
		$(this).find('#map_canvas').height(the_height+32);
		
		var userRoute = route.userRoute;
		
		var bounds =  new google.maps.LatLngBounds();
		
		var start = new google.maps.LatLng(userRoute.start_lat, userRoute.start_lon);
		var finish = new google.maps.LatLng(userRoute.end_lat, userRoute.end_lon);
		
		bounds.extend(start);
		bounds.extend(finish);
		
		$('#map_canvas').gmap({'center': bounds.getCenter(), 'zoom': 10, 'disableDefaultUI':true, 'callback': function() {
			var self = this;
			
			
			
			navigator.geolocation.watchPosition(function(position){
				var marker = self.get('markers > current');
				if (marker){
					marker.setPosition(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
				} else {
					self.addMarker({'id': 'current','position':new google.maps.LatLng(position.coords.latitude, position.coords.longitude), 
					'icon' : 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'});
				}
				if (route.followUser){
					self.option('center',new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
				}
		}, function(error){
			console.log('code: '    + error.code    + '\n' +
          'message: ' + error.message + '\n');}, {timeout: 30000});
		}}).bind('init', function(){
			$('#map_canvas').gmap('displayDirections', 
                { 'origin' : start, 
                  'destination' : finish, 'travelMode' : google.maps.DirectionsTravelMode.DRIVING},
                { },
                      function (result, status) {
                          if (status === 'OK') {
                              var center = result.routes[0].bounds.getCenter();
                              $('#map_canvas').gmap('option', 'center', center);
                              $('#map_canvas').gmap('refresh');
                          } else {
                            alert('Unable to get route');
                          }
                      }
                   ); 
		});
  		$('#map_canvas').gmap('refresh'); 
  		
		
    	
  	}
  });
  
  var checkins   = $('#checkins');
  checkins.on ({
  	pageshow : function(){
  		checkins.find('.data').mustache('checkins', $.extend({ checkins: checkins.kinveyData }, mustacheData),{method : 'html'}).listview('refresh');
  	}
  });
  
  $(document).delegate("#route","scrollstart",false);
  
  

  
}.call(this));