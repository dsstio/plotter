"use strict"

$(function () {

	$('#btnprintsmall').click(function () {
		send({msg:$('#text').val(), action:'printsmall'})
	})
	$('#btnprintbig').click(function () {
		send({msg:$('#text').val(), action:'printbig'})
	})
	$('#btnprintqrcode').click(function () {
		send({msg:$('#text').val(), action:'printqrcode'})
	})
	
	function send(data) {
		$.post('/api', data);
	}
})
