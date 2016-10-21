"use strict"


const fs = require('fs');
const quu = require('quu');
const path = require('path');
const hogan = require('hogan.js');
const express = require('express');
const bodyParser = require('body-parser');
const htmlencode = require('htmlencode');
const child_process = require('child_process');
const qrcode = require('qrcode-generator');

var images = getImages(
	path.resolve(__dirname, '../images'),
	path.resolve(__dirname, '../images/binaries'),
	path.resolve(__dirname, '../web/assets/images'),
	'assets/images/'
);

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/assets', express.static(path.resolve(__dirname, '../web/assets')));

app.all('/', function (req, res) {
	var html = fs.readFileSync(path.resolve(__dirname, '../web/index.html'), 'utf8');
	html = hogan.compile(html);
	html = html.render({images: images});
	res.send(html);
})

app.post('/api', function (req, res) {
	const body = req.body;
	switch (body.action) {
		case 'printsmall': printSmallText(body.msg); break;
		case 'printbig': printBigText(body.msg); break;
		case 'printqrcode': printQRCode(body.msg); break;
		case 'printimage': printImage(body.msg); break;
		default: console.error(body);
	}
	res.send('thanks');
})

app.listen(9600, function (err) {
	if (err) throw err;
	console.log('Server started on port 9600');
})

function printSmallText(text) {
	let size = [720, 150];
	let args = [
		'-colorspace','Gray',
		'-depth','8',
		'-size',(text.length*150)+'x200',
		'canvas:white',
		'-fill','black',
		'-stroke','black',
		'-pointsize','150',
		'-draw','text 0,150 "'+text.replace(/\"/g, c => '\\"')+'"',
		'-trim',
		'-resize',size.map(v => v-20).join('x')+'>',
		'-gravity','center',
		'-background','white',
		'-extent',size.join('x'),
		'-negate',
		'-flop',
		'-colorspace','Gray',
		'-depth','1',
		'gray:-'
	];

	renderImage(args, false, (data) => sendImageToPrinter(data, size));
}

function printBigText(text) {
	let size = [1600, 720];
	let args = [
		'-colorspace','Gray',
		'-depth','8',
		'-size',(text.length*300)+'x400',
		'canvas:black',
		'-fill','white',
		'-stroke','white',
		'-pointsize','300',
		'-draw','text 0,300 "'+text.replace(/\"/g, c => '\\"')+'"',
		'-trim',
		'-resize',size.map(v => v-200).join('x')+'>',
		'-gravity','center',
		'-background','black',
		'-extent',size.join('x'),
		'-rotate','90',
		'-flop',
		'-depth','1',
		'gray:-'
	];
	size.reverse();

	renderImage(args, false, (data) => sendImageToPrinter(data, size));
}

function printQRCode(text) {
	let ok = false, version = 1, qr;

	while (!ok) {
		try {
			qr = qrcode(version, 'M');
			qr.addData(text);
			qr.make();
			ok = true;
		} catch (e) {
			version++;
		}
	}

	let svg = qr.createSvgTag(1, 2);
	var qrsize = svg.match(/width\=\"([0-9]+)/i)[1];
	var density = Math.floor(72*720/qrsize);

	let smallSize = [720, 150];
	let size = [smallSize[0], smallSize[0]+smallSize[1]];
	let args = [
		'-colorspace','Gray',
		'-depth','8',
		'-size',(text.length*150)+'x200',
		'canvas:white',
		'-fill','black',
		'-stroke','black',
		'-pointsize','150',
		'-draw','text 0,150 "'+text.replace(/\"/g, c => '\\"')+'"',
		'-trim',
		'-resize',smallSize.map(v => v-20).join('x')+'>',
		'-gravity','center',
		'-background','white',
		'-extent',smallSize.join('x'),
		'-gravity','south',
		'-extent',size.join('x'),
		'-gravity','North',
		'(',
			'-density', density,
			'-size',[qrsize,qrsize].join('x'),
			'svg:-',
		')',
		'-composite',
		'-negate',
		'-flop',
		'-colorspace','Gray',
		'-depth','1',
		'gray:-'
	];

	renderImage(args, svg, (data) => sendImageToPrinter(data, size));
}

function printImage(key) {
	var image = images.filter(image => image.key === key);
	if (image.length !== 1) return;

	fs.readFile(image[0].bin, (err, buffer) => {
		sendPrintBuffer(buffer);
	})
}

function image2buffer(filename, cb) {
	let args = [
		filename,
		'-colorspace','Gray',
		'-depth','8',
		'-resize','670x>',
		'-gravity','center',
		'-background','white',
		'-extent','720x',
		'-negate',
		'-flop',
		'-colorspace','Gray',
		'-depth','1',
		'gray:-'
	];

	renderImage(args, false, (data) => {
		let size = [720, Math.round(data.length*8/720)];
		cb(data, size);
	});
}

function renderImage(args, input, cb) {
	var result = [];
	var child = child_process.spawn('convert', args);
	
	if (input) child.stdin.end(input);

	child.stderr.on('data', data => console.error(data.toString()));
	child.stdout.on('data', data => result.push(data));
	child.on('close', () => {
		result = Buffer.concat(result);
		cb(result);
	});
}

function sendImageToPrinter(image, size) {
	if (debug) {
		var child = child_process.spawn('convert', ['-size',size.join('x'),'-depth',1,'gray:-','-negate','-flop','temp.png']);
		child.stdin.end(image);
	} else {
		sendPrintBuffer(createPrintBuffer(image, size));
	}
}

function createPrintBuffer(image, size) {
	let buffer = new Buffer(1024*1024);
	let pos = 0;

	write([0x1b,'@']); // Init
	write([0x1b,'i','z',0xa6,0x0a,0x3e,0,size[1] & 0xff,size[1] >> 8,0,0,0,0]); // Set media type
	write([0x1b,'i','K']); // Set cut type
	write([0x1b,'i','A']); // Enable cutter
	write([0x1b,'i','d',0,0]); // Set margin = 0

	var lb = Math.floor(size[0] / 8) + (size[0] % 8 > 0 ? 1 : 0);
	for (let y = 0; y < size[1]; y++) {
		write(['g', 0x00, 90]);
		copy(image.slice(y*lb, (y+1)*lb));
		for (let x = lb; lb < 90; lb++) write([0x00]);
	}

	write([0x1a]); // Print

	return buffer.slice(0,pos);

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

}

function sendPrintBuffer(buffer) {
	fs.writeFile('/dev/usb/lp0', buffer);
}

function getImages(src, bin, web, url) {
	ensureDirSync(src);
	ensureDirSync(bin);
	ensureDirSync(web);

	var images = fs.readdirSync(src);

	var queue = quu(1);

	images = images.map(image => {
		if (path.extname(image) !== '.png') return false;

		var name = setExt(image, '');
		var key = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
		var srcFile = path.resolve(src, image);
		var binFile = setExt(path.resolve(bin, image), '.bin');
		var webFile = setExt(path.resolve(web, image), '.png');
		var urlFile = setExt(url + image, '.png');

		if (!existsSync(binFile) || !existsSync(webFile)) {
			queue.push((done) => {
				image2buffer(srcFile, (image, size) => {
					var buffer = createPrintBuffer(image, size)
					fs.writeFileSync(binFile, buffer);
					var child = child_process.spawn('convert', ['-size',size.join('x'),'-depth',1,'gray:-','-negate','-flop',webFile]);
					child.stdin.end(image);
					child.on('close', done)
				})
			})
		}

		return {
			key: key,
			name: name,
			bin: binFile,
			url: urlFile
		}
	})

	images = images.filter(e => e);

	images.sort((a,b) => a.name < b.name ? -1 : 1);

	return images

	function existsSync(file) {
		try {
			fs.accessSync(file);
			return true;
		} catch (e) {
			return false;
		}
	}

	function ensureDirSync(fol) {
		try {
			fs.accessSync(fol);
		} catch (e) {
			ensureDirSync(path.dirname(fol));
			fs.mkdirSync(fol);
		}
	}

	function setExt(filename, ext) {
		return filename.replace(/\.[a-z0-9]+$/gi, '') + ext;
	}
}





