"use strict"


const fs = require('fs');
const Url = require('url');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const htmlencode = require('htmlencode');
const child_process = require('child_process');

const template = fs.readFileSync(path.resolve(__dirname, '../web/index.html'), 'utf8');
 
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/assets', express.static(path.resolve(__dirname, '../web/assets')));


app.all('/', function (req, res) {
	const body = req.body;
	if (body.print) print(body.print);
	res.send(getPage())
})

app.listen(9600, function (err) {
	if (err) throw err;
	console.log('Server started on port 9600');
})

function getPage() {
	return template;
}

function print(text) {
	let size = [1600, 720];

	let args = [
		'-colorspace','Gray',
		'-depth','8',
		'-size','6000x300',
		'canvas:black',
		'-fill','white',
		'-stroke','white',
		'-pointsize','200',
		'-draw','text 0,200 "'+text.replace(/\"/g, c => '\\"')+'"',
		'-trim',
		'-resize',size.join('x')+'>',
		'-gravity','center',
		'-background','black',
		'-extent',size.join('x'),
		'-rotate','90',
		'-flop',
		'-depth','1',
		'gray:-'
	];

	var result = [];
	var child = child_process.spawn('convert', args);
	child.stderr.on('data', data => console.error(data.toString()));
	child.stdout.on('data', data => result.push(data));
	child.on('close', () => {
		result = Buffer.concat(result);

		let buffer = new Buffer(200*1024);
		let pos = 0;

		write([0x1b,'@']); // Init
		write([0x1b,'i','z',0xa6,0x0a,0x3e,0,size[0] & 0xff,size[0] >> 8,0,0,0,0]); // Set media type
		write([0x1b,'i','K']); // Set cut type
		write([0x1b,'i','A']); // Enable cutter
		write([0x1b,'i','d',0,0]); // Set margin = 0

		var lb = Math.floor(size[1] / 8) + (size[1] % 8 > 0 ? 1 : 0);
		for (let y = 0; y < size[0]; y++) {
			write(['g', 0x00, 90]);
			copy(result.slice(y*lb, (y+1)*lb));
			for (let x = lb; lb < 90; lb++) write([0x00]);
		}

		write([0x1a]); // Print

		if (debug) {
			var child = child_process.spawn('convert', ['-size',size.reverse().join('x'),'-depth',1,'gray:-','temp.png']);
			child.stdin.end(result);
		} else {
			fs.writeFile('/dev/usb/lp0', buffer.slice(0,pos));
		}

		function write(data) {
			data.forEach(value => {
				if (typeof value === 'string') value = value.charCodeAt(0);
				buffer.writeUInt8(value, pos);
				pos++;
			})
		}

		function copy(data) {
			data.copy(buffer, pos);
			pos += data.length;
		}
		fs.writeFileSync('temp.bin', result);
	});
}






