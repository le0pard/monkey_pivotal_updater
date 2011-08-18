var MonkeyPivotal = {
	current_tab_url: null,
	bg_page: null,
	gdoc: null,
	
	init: function(){
		this.bg_page = chrome.extension.getBackgroundPage();
		this.auth_check();
		this.bind_elements();
		this.init_analyze_document();
	},
	
	auth_check: function(){
		this.bg_page.oauth.authorize(function() {
		  MonkeyPivotal.schedule_request();
		});
	},
	
	bind_elements: function(){
		$('#begin_analyze').click(function(event){
			MonkeyPivotal.begin_analyze();
		});
	},
	
	init_analyze_document: function(){
		chrome.tabs.getSelected(null,function(tab) {
		    MonkeyPivotal.current_tab_url = tab.url;
		});
	},
	
	schedule_request: function() {
		if (this.bg_page.oauth.hasToken()) {
			$('#monkey_box').show();
		} else {
			this.show_message('Please, authorize app.');
		}
	},
	
	begin_analyze: function(){
		if (this.current_tab_url != null){
			var regex_pattern = /^(http|https):\/\/([\w\.\/]+)\/document\/d\/([\w\.\-\_]+)\/(.*)/i;
			if (regex_pattern.test(this.current_tab_url)){
				var found_str = this.current_tab_url.match(regex_pattern);
				if (found_str[3]){
					this.download_gdocument(found_str[3]);
				} else {
					this.show_message('Please, go to google document');
				}
			} else {
				this.show_message('Please, go to google document');
			}
		} else {
			this.show_message('Please, go to google document');
		}
	},
	
	download_gdocument: function(key){
		var url = 'https://docs.google.com/feeds/download/documents/Export?docID=' + key + '&exportFormat=html&format=html';
		var params = {
	    'method': 'GET',
	    'headers': {
	      'GData-Version': '3.0'
	    },
			'parameters': {'alt': 'json'}
	  };
		this.bg_page.oauth.sendSignedRequest(url, MonkeyPivotal.handle_dowload_success, params);
	},
	
	handle_dowload_success: function(resp, xhr){
		this.show_message("test");
		//var json_data = JSON.parse(resp).entry;
		//this.show_message(json_data);
	},
	
	show_message: function(msg){
		$('#messages').html(msg);
	}
	
};


$(function() {
	MonkeyPivotal.init();
});

