var MonkeyPivotal = {
	current_tab_url: null,
	bg_page: null,
	
	init: function(){
		this.bind_elements();
		this.init_analyze_document();
	},
	
	bind_elements: function(){
		this.bg_page = chrome.extension.getBackgroundPage();
		$('#begin_analyze').click(function(event){
			MonkeyPivotal.begin_analyze();
		});
	},
	
	init_analyze_document: function(){
		chrome.tabs.getSelected(null,function(tab) {
		    MonkeyPivotal.current_tab_url = tab.url;
		});
	},
	
	begin_analyze: function(){
		$('#begin_analyze').html(this.current_tab_url);
	}
	
};


$(function() {
	MonkeyPivotal.init();
});

