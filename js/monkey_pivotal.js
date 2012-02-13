var MonkeyPivotal = {
	bg_page: null,
	
	pivotal_regex_g: /https:\/\/www.pivotaltracker.com\/story\/show\/([\d]+)/gi,
	
	init: function(){
		this.bg_page = chrome.extension.getBackgroundPage();
		this.bind_elements();
		this.auth_check();		
	},
	
	auth_check: function(){
		this.bg_page.oauth.authorize(function() {
		  if (!MonkeyPivotal.bg_page.MonkeyPivotalBackground.is_started){
		  	MonkeyPivotal.init_analyze_document();
		  } else {
		    	MonkeyPivotal.loading_message('Loading...');
		  }
		});
	},
	
	bind_elements: function(){
		$('#start_update_current').click(function(event){
			MonkeyPivotal.start_update_document(false);
		});
		$('#start_update_new').click(function(event){
			MonkeyPivotal.start_update_document(true);
		});
		chrome.extension.onRequest.addListener(
		  function(request, sender, sendResponse) {
		    if (request.loading_message){
		      MonkeyPivotal.update_loading_message(request.loading_message);
		      sendResponse({loading_message: "ok"});
		    } else if (request.notice_message){
		      MonkeyPivotal.show_message(request.notice_message, 'notice');
		      sendResponse({notice_message: "ok"});
        } else if (request.error_message){
		      MonkeyPivotal.show_message(request.error_message, 'error');
		      sendResponse({error_message: "ok"});
		    } else if (request.hide_popup_buttons){
                      MonkeyPivotal.hide_buttons();
                      sendResponse({hide_popup_buttons: "ok"});
		    } else {
		      sendResponse({});
		    }
		  });
	},
	
	init_analyze_document: function(){
		chrome.windows.getCurrent(function(w) {
			chrome.tabs.getSelected(w.id, function(tab){	
				MonkeyPivotal.begin_analyze(tab.url);
			});
		});
	},
	
	begin_analyze: function(current_tab_url){
	  if (localStorage.pivotal_token != null && localStorage.pivotal_token.length > 0){
  		if (current_tab_url != null){
  			var regex_pattern = /^(http|https):\/\/([\w\.\/]+)\/document\/d\/([\w\.\-\_]+)\/(.*)/i;
  			if (regex_pattern.test(current_tab_url)){
  				var found_str = current_tab_url.match(regex_pattern);
  				if (found_str[3]){
  					this.bg_page.MonkeyPivotalBackground.doc_key = found_str[3];
  					this.download_gdocument(this.bg_page.MonkeyPivotalBackground.doc_key);
  				} else {
  					this.show_message('Please, open google document', 'notice');
  				}
  			} else {
  				this.show_message('Please, open google document', 'notice');
  			}
  		} else {
  			this.show_message('Please, open google document', 'notice');
  		}
	  } else {
	    this.show_message('Please, setup pivotal token in options', 'notice');
	  }
	},
	
	download_gdocument: function(key){
		this.loading_message('Loading document...');
		var url = 'https://docs.google.com/feeds/download/documents/export/Export?id=' + key;
		$.get(url, function(data){ 
			MonkeyPivotal.handle_dowload_success(data);
		}).error(function(jqXHR, textStatus, errorThrown) { 
			MonkeyPivotal.show_message('Error loadign document! Debug: ' + textStatus, 'error');
    });
	},
	
	handle_dowload_success: function(response){
		this.bg_page.MonkeyPivotalBackground.gdoc = response;
		this.bg_page.MonkeyPivotalBackground.gmatches = this.unique_array(this.bg_page.MonkeyPivotalBackground.gdoc.match(this.pivotal_regex_g));
		if (this.bg_page.MonkeyPivotalBackground.gmatches.length > 0){
			this.show_message('Found ' + this.bg_page.MonkeyPivotalBackground.gmatches.length + ' link(s).', 'notice');
			this.show_buttons();
		} else {
			this.show_message('Document doesn\'t contain pivotal links :(', 'warning');
		}
	},

	unique_array: function(array){
		var dupes = {}; 
		var len, i;
		for (i=0,len=array.length; i<len; i++){
			var test = array[i].toString();
			if (dupes[test]) { 
				array.splice(i,1); 
				len--; 
				i--; 
			} else { 
				dupes[test] = true; 
			}
		}
		return array;
	},
	
	show_buttons: function(){
		$('#control_buttons_box').show();
	},
	
	hide_buttons: function(){
		$('#control_buttons_box').hide();
	},
	
	start_update_document: function(in_new){
		if (this.bg_page.MonkeyPivotalBackground.gdoc != null && this.bg_page.MonkeyPivotalBackground.gmatches.length > 0){
			this.loading_message('Processing links...');
			this.bg_page.MonkeyPivotalBackground.update_doc_iteration(in_new);
			this.hide_buttons();
		} else {
		  this.show_message('Document doesn\'t contain pivotal links :(', 'warning');
		}
	},
	
	show_message: function(msg, msg_type){
		$('#flash_messages .msg').html(msg);
		$('#flash_messages .message').removeClass('error warning notice loading').addClass(msg_type);
		$('#flash_messages').show();
	},

	hide_message: function(){
		$('#flash_messages').hide();
	},
        
  loading_message: function(msg){
		this.hide_message();
		$('#flash_messages .msg').html(msg);
		$('#flash_messages .message').removeClass('error warning notice').addClass('loading');
		$('#flash_messages').show();
		
	},
	update_loading_message: function(msg){
		$('#flash_messages .msg').html(msg);
	}
	
};


$(function() {
	MonkeyPivotal.init();
});

