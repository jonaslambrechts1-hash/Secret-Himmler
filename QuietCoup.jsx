import React, { useState, useEffect, useRef, useCallback } from "react";

/* ============================= QR CODE (embedded, no network needed) ============================= */
/* qrcode-generator by Kazuhiko Arase, MIT license */
//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

var qrcode = function() {

  //---------------------------------------------------------------------
  // qrcode
  //---------------------------------------------------------------------

  /**
   * qrcode
   * @param typeNumber 1 to 40
   * @param errorCorrectionLevel 'L','M','Q','H'
   */
  var qrcode = function(typeNumber, errorCorrectionLevel) {

    var PAD0 = 0xEC;
    var PAD1 = 0x11;

    var _typeNumber = typeNumber;
    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    var _modules = null;
    var _moduleCount = 0;
    var _dataCache = null;
    var _dataList = [];

    var _this = {};

    var makeImpl = function(test, maskPattern) {

      _moduleCount = _typeNumber * 4 + 17;
      _modules = function(moduleCount) {
        var modules = new Array(moduleCount);
        for (var row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (var col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      }(_moduleCount);

      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);

      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }

      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }

      mapData(_dataCache, maskPattern);
    };

    var setupPositionProbePattern = function(row, col) {

      for (var r = -1; r <= 7; r += 1) {

        if (row + r <= -1 || _moduleCount <= row + r) continue;

        for (var c = -1; c <= 7; c += 1) {

          if (col + c <= -1 || _moduleCount <= col + c) continue;

          if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
              || (0 <= c && c <= 6 && (r == 0 || r == 6) )
              || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };

    var getBestMaskPattern = function() {

      var minLostPoint = 0;
      var pattern = 0;

      for (var i = 0; i < 8; i += 1) {

        makeImpl(true, i);

        var lostPoint = QRUtil.getLostPoint(_this);

        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }

      return pattern;
    };

    var setupTimingPattern = function() {

      for (var r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = (r % 2 == 0);
      }

      for (var c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = (c % 2 == 0);
      }
    };

    var setupPositionAdjustPattern = function() {

      var pos = QRUtil.getPatternPosition(_typeNumber);

      for (var i = 0; i < pos.length; i += 1) {

        for (var j = 0; j < pos.length; j += 1) {

          var row = pos[i];
          var col = pos[j];

          if (_modules[row][col] != null) {
            continue;
          }

          for (var r = -2; r <= 2; r += 1) {

            for (var c = -2; c <= 2; c += 1) {

              if (r == -2 || r == 2 || c == -2 || c == 2
                  || (r == 0 && c == 0) ) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };

    var setupTypeNumber = function(test) {

      var bits = QRUtil.getBCHTypeNumber(_typeNumber);

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };

    var setupTypeInfo = function(test, maskPattern) {

      var data = (_errorCorrectionLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);

      // vertical
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }

      // horizontal
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }

      // fixed module
      _modules[_moduleCount - 8][8] = (!test);
    };

    var mapData = function(data, maskPattern) {

      var inc = -1;
      var row = _moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      var maskFunc = QRUtil.getMaskFunction(maskPattern);

      for (var col = _moduleCount - 1; col > 0; col -= 2) {

        if (col == 6) col -= 1;

        while (true) {

          for (var c = 0; c < 2; c += 1) {

            if (_modules[row][col - c] == null) {

              var dark = false;

              if (byteIndex < data.length) {
                dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
              }

              var mask = maskFunc(row, col - c);

              if (mask) {
                dark = !dark;
              }

              _modules[row][col - c] = dark;
              bitIndex -= 1;

              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }

          row += inc;

          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };

    var createBytes = function(buffer, rsBlocks) {

      var offset = 0;

      var maxDcCount = 0;
      var maxEcCount = 0;

      var dcdata = new Array(rsBlocks.length);
      var ecdata = new Array(rsBlocks.length);

      for (var r = 0; r < rsBlocks.length; r += 1) {

        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;

        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);

        for (var i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;

        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i += 1) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
        }
      }

      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }

      var data = new Array(totalCodeCount);
      var index = 0;

      for (var i = 0; i < maxDcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }

      for (var i = 0; i < maxEcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }

      return data;
    };

    var createData = function(typeNumber, errorCorrectionLevel, dataList) {

      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

      var buffer = qrBitBuffer();

      for (var i = 0; i < dataList.length; i += 1) {
        var data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
        data.write(buffer);
      }

      // calc num max data.
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }

      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw 'code length overflow. ('
          + buffer.getLengthInBits()
          + '>'
          + totalDataCount * 8
          + ')';
      }

      // end code
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }

      // padding
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }

      // padding
      while (true) {

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }

      return createBytes(buffer, rsBlocks);
    };

    _this.addData = function(data, mode) {

      mode = mode || 'Byte';

      var newData = null;

      switch(mode) {
      case 'Numeric' :
        newData = qrNumber(data);
        break;
      case 'Alphanumeric' :
        newData = qrAlphaNum(data);
        break;
      case 'Byte' :
        newData = qr8BitByte(data);
        break;
      case 'Kanji' :
        newData = qrKanji(data);
        break;
      default :
        throw 'mode:' + mode;
      }

      _dataList.push(newData);
      _dataCache = null;
    };

    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + ',' + col;
      }
      return _modules[row][col];
    };

    _this.getModuleCount = function() {
      return _moduleCount;
    };

    _this.make = function() {
      if (_typeNumber < 1) {
        var typeNumber = 1;

        for (; typeNumber < 40; typeNumber++) {
          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
          var buffer = qrBitBuffer();

          for (var i = 0; i < _dataList.length; i++) {
            var data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
            data.write(buffer);
          }

          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }

          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }

        _typeNumber = typeNumber;
      }

      makeImpl(false, getBestMaskPattern() );
    };

    _this.createTableTag = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var qrHtml = '';

      qrHtml += '<table style="';
      qrHtml += ' border-width: 0px; border-style: none;';
      qrHtml += ' border-collapse: collapse;';
      qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
      qrHtml += '">';
      qrHtml += '<tbody>';

      for (var r = 0; r < _this.getModuleCount(); r += 1) {

        qrHtml += '<tr>';

        for (var c = 0; c < _this.getModuleCount(); c += 1) {
          qrHtml += '<td style="';
          qrHtml += ' border-width: 0px; border-style: none;';
          qrHtml += ' border-collapse: collapse;';
          qrHtml += ' padding: 0px; margin: 0px;';
          qrHtml += ' width: ' + cellSize + 'px;';
          qrHtml += ' height: ' + cellSize + 'px;';
          qrHtml += ' background-color: ';
          qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
          qrHtml += ';';
          qrHtml += '"/>';
        }

        qrHtml += '</tr>';
      }

      qrHtml += '</tbody>';
      qrHtml += '</table>';

      return qrHtml;
    };

    _this.createSvgTag = function(cellSize, margin, alt, title) {

      var opts = {};
      if (typeof arguments[0] == 'object') {
        // Called by options.
        opts = arguments[0];
        // overwrite cellSize and margin.
        cellSize = opts.cellSize;
        margin = opts.margin;
        alt = opts.alt;
        title = opts.title;
      }

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      // Compose alt property surrogate
      alt = (typeof alt === 'string') ? {text: alt} : alt || {};
      alt.text = alt.text || null;
      alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;

      // Compose title property surrogate
      title = (typeof title === 'string') ? {text: title} : title || {};
      title.text = title.text || null;
      title.id = (title.text) ? title.id || 'qrcode-title' : null;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var c, mc, r, mr, qrSvg='', rect;

      rect = 'l' + cellSize + ',0 0,' + cellSize +
        ' -' + cellSize + ',0 0,-' + cellSize + 'z ';

      qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
      qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : '';
      qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
      qrSvg += ' preserveAspectRatio="xMinYMin meet"';
      qrSvg += (title.text || alt.text) ? ' role="img" aria-labelledby="' +
          escapeXml([title.id, alt.id].join(' ').trim() ) + '"' : '';
      qrSvg += '>';
      qrSvg += (title.text) ? '<title id="' + escapeXml(title.id) + '">' +
          escapeXml(title.text) + '</title>' : '';
      qrSvg += (alt.text) ? '<description id="' + escapeXml(alt.id) + '">' +
          escapeXml(alt.text) + '</description>' : '';
      qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
      qrSvg += '<path d="';

      for (r = 0; r < _this.getModuleCount(); r += 1) {
        mr = r * cellSize + margin;
        for (c = 0; c < _this.getModuleCount(); c += 1) {
          if (_this.isDark(r, c) ) {
            mc = c*cellSize+margin;
            qrSvg += 'M' + mc + ',' + mr + rect;
          }
        }
      }

      qrSvg += '" stroke="transparent" fill="black"/>';
      qrSvg += '</svg>';

      return qrSvg;
    };

    _this.createDataURL = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      return createDataURL(size, size, function(x, y) {
        if (min <= x && x < max && min <= y && y < max) {
          var c = Math.floor( (x - min) / cellSize);
          var r = Math.floor( (y - min) / cellSize);
          return _this.isDark(r, c)? 0 : 1;
        } else {
          return 1;
        }
      } );
    };

    _this.createImgTag = function(cellSize, margin, alt) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;

      var img = '';
      img += '<img';
      img += '\u0020src="';
      img += _this.createDataURL(cellSize, margin);
      img += '"';
      img += '\u0020width="';
      img += size;
      img += '"';
      img += '\u0020height="';
      img += size;
      img += '"';
      if (alt) {
        img += '\u0020alt="';
        img += escapeXml(alt);
        img += '"';
      }
      img += '/>';

      return img;
    };

    var escapeXml = function(s) {
      var escaped = '';
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charAt(i);
        switch(c) {
        case '<': escaped += '&lt;'; break;
        case '>': escaped += '&gt;'; break;
        case '&': escaped += '&amp;'; break;
        case '"': escaped += '&quot;'; break;
        default : escaped += c; break;
        }
      }
      return escaped;
    };

    var _createHalfASCII = function(margin) {
      var cellSize = 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r1, r2, p;

      var blocks = {
        '██': '█',
        '█ ': '▀',
        ' █': '▄',
        '  ': ' '
      };

      var blocksLastLineNoMargin = {
        '██': '▀',
        '█ ': '▀',
        ' █': ' ',
        '  ': ' '
      };

      var ascii = '';
      for (y = 0; y < size; y += 2) {
        r1 = Math.floor((y - min) / cellSize);
        r2 = Math.floor((y + 1 - min) / cellSize);
        for (x = 0; x < size; x += 1) {
          p = '█';

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
            p = ' ';
          }

          if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
            p += ' ';
          }
          else {
            p += '█';
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];
        }

        ascii += '\n';
      }

      if (size % 2 && margin > 0) {
        return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.createASCII = function(cellSize, margin) {
      cellSize = cellSize || 1;

      if (cellSize < 2) {
        return _createHalfASCII(margin);
      }

      cellSize -= 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r, p;

      var white = Array(cellSize+1).join('██');
      var black = Array(cellSize+1).join('  ');

      var ascii = '';
      var line = '';
      for (y = 0; y < size; y += 1) {
        r = Math.floor( (y - min) / cellSize);
        line = '';
        for (x = 0; x < size; x += 1) {
          p = 1;

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
            p = 0;
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          line += p ? white : black;
        }

        for (r = 0; r < cellSize; r += 1) {
          ascii += line + '\n';
        }
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.renderTo2dContext = function(context, cellSize) {
      cellSize = cellSize || 2;
      var length = _this.getModuleCount();
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';
          context.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    }

    return _this;
  };

  //---------------------------------------------------------------------
  // qrcode.stringToBytes
  //---------------------------------------------------------------------

  qrcode.stringToBytesFuncs = {
    'default' : function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        bytes.push(c & 0xff);
      }
      return bytes;
    }
  };

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];

  //---------------------------------------------------------------------
  // qrcode.createStringToBytes
  //---------------------------------------------------------------------

  /**
   * @param unicodeData base64 string of byte array.
   * [16bit Unicode],[16bit Bytes], ...
   * @param numChars
   */
  qrcode.createStringToBytes = function(unicodeData, numChars) {

    // create conversion map.

    var unicodeMap = function() {

      var bin = base64DecodeInputStream(unicodeData);
      var read = function() {
        var b = bin.read();
        if (b == -1) throw 'eof';
        return b;
      };

      var count = 0;
      var unicodeMap = {};
      while (true) {
        var b0 = bin.read();
        if (b0 == -1) break;
        var b1 = read();
        var b2 = read();
        var b3 = read();
        var k = String.fromCharCode( (b0 << 8) | b1);
        var v = (b2 << 8) | b3;
        unicodeMap[k] = v;
        count += 1;
      }
      if (count != numChars) {
        throw count + ' != ' + numChars;
      }

      return unicodeMap;
    }();

    var unknownChar = '?'.charCodeAt(0);

    return function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        if (c < 128) {
          bytes.push(c);
        } else {
          var b = unicodeMap[s.charAt(i)];
          if (typeof b == 'number') {
            if ( (b & 0xff) == b) {
              // 1byte
              bytes.push(b);
            } else {
              // 2bytes
              bytes.push(b >>> 8);
              bytes.push(b & 0xff);
            }
          } else {
            bytes.push(unknownChar);
          }
        }
      }
      return bytes;
    };
  };

  //---------------------------------------------------------------------
  // QRMode
  //---------------------------------------------------------------------

  var QRMode = {
    MODE_NUMBER :    1 << 0,
    MODE_ALPHA_NUM : 1 << 1,
    MODE_8BIT_BYTE : 1 << 2,
    MODE_KANJI :     1 << 3
  };

  //---------------------------------------------------------------------
  // QRErrorCorrectionLevel
  //---------------------------------------------------------------------

  var QRErrorCorrectionLevel = {
    L : 1,
    M : 0,
    Q : 3,
    H : 2
  };

  //---------------------------------------------------------------------
  // QRMaskPattern
  //---------------------------------------------------------------------

  var QRMaskPattern = {
    PATTERN000 : 0,
    PATTERN001 : 1,
    PATTERN010 : 2,
    PATTERN011 : 3,
    PATTERN100 : 4,
    PATTERN101 : 5,
    PATTERN110 : 6,
    PATTERN111 : 7
  };

  //---------------------------------------------------------------------
  // QRUtil
  //---------------------------------------------------------------------

  var QRUtil = function() {

    var PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    var _this = {};

    var getBCHDigit = function(data) {
      var digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };

    _this.getBCHTypeInfo = function(data) {
      var d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
      }
      return ( (data << 10) | d) ^ G15_MASK;
    };

    _this.getBCHTypeNumber = function(data) {
      var d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
      }
      return (data << 12) | d;
    };

    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };

    _this.getMaskFunction = function(maskPattern) {

      switch (maskPattern) {

      case QRMaskPattern.PATTERN000 :
        return function(i, j) { return (i + j) % 2 == 0; };
      case QRMaskPattern.PATTERN001 :
        return function(i, j) { return i % 2 == 0; };
      case QRMaskPattern.PATTERN010 :
        return function(i, j) { return j % 3 == 0; };
      case QRMaskPattern.PATTERN011 :
        return function(i, j) { return (i + j) % 3 == 0; };
      case QRMaskPattern.PATTERN100 :
        return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
      case QRMaskPattern.PATTERN101 :
        return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
      case QRMaskPattern.PATTERN110 :
        return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
      case QRMaskPattern.PATTERN111 :
        return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

      default :
        throw 'bad maskPattern:' + maskPattern;
      }
    };

    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      var a = qrPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
      }
      return a;
    };

    _this.getLengthInBits = function(mode, type) {

      if (1 <= type && type < 10) {

        // 1 - 9

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 10;
        case QRMode.MODE_ALPHA_NUM : return 9;
        case QRMode.MODE_8BIT_BYTE : return 8;
        case QRMode.MODE_KANJI     : return 8;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 27) {

        // 10 - 26

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 12;
        case QRMode.MODE_ALPHA_NUM : return 11;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 10;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 41) {

        // 27 - 40

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 14;
        case QRMode.MODE_ALPHA_NUM : return 13;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 12;
        default :
          throw 'mode:' + mode;
        }

      } else {
        throw 'type:' + type;
      }
    };

    _this.getLostPoint = function(qrcode) {

      var moduleCount = qrcode.getModuleCount();

      var lostPoint = 0;

      // LEVEL1

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount; col += 1) {

          var sameCount = 0;
          var dark = qrcode.isDark(row, col);

          for (var r = -1; r <= 1; r += 1) {

            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }

            for (var c = -1; c <= 1; c += 1) {

              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }

              if (r == 0 && c == 0) {
                continue;
              }

              if (dark == qrcode.isDark(row + r, col + c) ) {
                sameCount += 1;
              }
            }
          }

          if (sameCount > 5) {
            lostPoint += (3 + sameCount - 5);
          }
        }
      };

      // LEVEL2

      for (var row = 0; row < moduleCount - 1; row += 1) {
        for (var col = 0; col < moduleCount - 1; col += 1) {
          var count = 0;
          if (qrcode.isDark(row, col) ) count += 1;
          if (qrcode.isDark(row + 1, col) ) count += 1;
          if (qrcode.isDark(row, col + 1) ) count += 1;
          if (qrcode.isDark(row + 1, col + 1) ) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }

      // LEVEL3

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row, col + 1)
              &&  qrcode.isDark(row, col + 2)
              &&  qrcode.isDark(row, col + 3)
              &&  qrcode.isDark(row, col + 4)
              && !qrcode.isDark(row, col + 5)
              &&  qrcode.isDark(row, col + 6) ) {
            lostPoint += 40;
          }
        }
      }

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row + 1, col)
              &&  qrcode.isDark(row + 2, col)
              &&  qrcode.isDark(row + 3, col)
              &&  qrcode.isDark(row + 4, col)
              && !qrcode.isDark(row + 5, col)
              &&  qrcode.isDark(row + 6, col) ) {
            lostPoint += 40;
          }
        }
      }

      // LEVEL4

      var darkCount = 0;

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount; row += 1) {
          if (qrcode.isDark(row, col) ) {
            darkCount += 1;
          }
        }
      }

      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // QRMath
  //---------------------------------------------------------------------

  var QRMath = function() {

    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);

    // initialize tables
    for (var i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (var i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4]
        ^ EXP_TABLE[i - 5]
        ^ EXP_TABLE[i - 6]
        ^ EXP_TABLE[i - 8];
    }
    for (var i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i] ] = i;
    }

    var _this = {};

    _this.glog = function(n) {

      if (n < 1) {
        throw 'glog(' + n + ')';
      }

      return LOG_TABLE[n];
    };

    _this.gexp = function(n) {

      while (n < 0) {
        n += 255;
      }

      while (n >= 256) {
        n -= 255;
      }

      return EXP_TABLE[n];
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrPolynomial
  //---------------------------------------------------------------------

  function qrPolynomial(num, shift) {

    if (typeof num.length == 'undefined') {
      throw num.length + '/' + shift;
    }

    var _num = function() {
      var offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      var _num = new Array(num.length - offset + shift);
      for (var i = 0; i < num.length - offset; i += 1) {
        _num[i] = num[i + offset];
      }
      return _num;
    }();

    var _this = {};

    _this.getAt = function(index) {
      return _num[index];
    };

    _this.getLength = function() {
      return _num.length;
    };

    _this.multiply = function(e) {

      var num = new Array(_this.getLength() + e.getLength() - 1);

      for (var i = 0; i < _this.getLength(); i += 1) {
        for (var j = 0; j < e.getLength(); j += 1) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
        }
      }

      return qrPolynomial(num, 0);
    };

    _this.mod = function(e) {

      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }

      var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );

      var num = new Array(_this.getLength() );
      for (var i = 0; i < _this.getLength(); i += 1) {
        num[i] = _this.getAt(i);
      }

      for (var i = 0; i < e.getLength(); i += 1) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
      }

      // recursive call
      return qrPolynomial(num, 0).mod(e);
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // QRRSBlock
  //---------------------------------------------------------------------

  var QRRSBlock = function() {

    var RS_BLOCK_TABLE = [

      // L
      // M
      // Q
      // H

      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],

      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],

      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],

      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],

      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],

      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],

      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],

      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],

      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],

      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],

      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],

      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],

      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],

      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],

      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],

      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],

      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],

      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],

      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],

      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],

      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],

      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],

      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],

      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],

      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],

      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],

      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],

      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],

      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],

      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],

      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],

      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],

      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],

      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],

      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],

      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],

      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],

      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],

      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],

      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];

    var qrRSBlock = function(totalCount, dataCount) {
      var _this = {};
      _this.totalCount = totalCount;
      _this.dataCount = dataCount;
      return _this;
    };

    var _this = {};

    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {

      switch(errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default :
        return undefined;
      }
    };

    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {

      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);

      if (typeof rsBlock == 'undefined') {
        throw 'bad rs block @ typeNumber:' + typeNumber +
            '/errorCorrectionLevel:' + errorCorrectionLevel;
      }

      var length = rsBlock.length / 3;

      var list = [];

      for (var i = 0; i < length; i += 1) {

        var count = rsBlock[i * 3 + 0];
        var totalCount = rsBlock[i * 3 + 1];
        var dataCount = rsBlock[i * 3 + 2];

        for (var j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount) );
        }
      }

      return list;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrBitBuffer
  //---------------------------------------------------------------------

  var qrBitBuffer = function() {

    var _buffer = [];
    var _length = 0;

    var _this = {};

    _this.getBuffer = function() {
      return _buffer;
    };

    _this.getAt = function(index) {
      var bufIndex = Math.floor(index / 8);
      return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
    };

    _this.put = function(num, length) {
      for (var i = 0; i < length; i += 1) {
        _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
      }
    };

    _this.getLengthInBits = function() {
      return _length;
    };

    _this.putBit = function(bit) {

      var bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }

      if (bit) {
        _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
      }

      _length += 1;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrNumber
  //---------------------------------------------------------------------

  var qrNumber = function(data) {

    var _mode = QRMode.MODE_NUMBER;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var data = _data;

      var i = 0;

      while (i + 2 < data.length) {
        buffer.put(strToNum(data.substring(i, i + 3) ), 10);
        i += 3;
      }

      if (i < data.length) {
        if (data.length - i == 1) {
          buffer.put(strToNum(data.substring(i, i + 1) ), 4);
        } else if (data.length - i == 2) {
          buffer.put(strToNum(data.substring(i, i + 2) ), 7);
        }
      }
    };

    var strToNum = function(s) {
      var num = 0;
      for (var i = 0; i < s.length; i += 1) {
        num = num * 10 + chatToNum(s.charAt(i) );
      }
      return num;
    };

    var chatToNum = function(c) {
      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      }
      throw 'illegal char :' + c;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrAlphaNum
  //---------------------------------------------------------------------

  var qrAlphaNum = function(data) {

    var _mode = QRMode.MODE_ALPHA_NUM;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var s = _data;

      var i = 0;

      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i) ) * 45 +
          getCode(s.charAt(i + 1) ), 11);
        i += 2;
      }

      if (i < s.length) {
        buffer.put(getCode(s.charAt(i) ), 6);
      }
    };

    var getCode = function(c) {

      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      } else if ('A' <= c && c <= 'Z') {
        return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
      } else {
        switch (c) {
        case ' ' : return 36;
        case '$' : return 37;
        case '%' : return 38;
        case '*' : return 39;
        case '+' : return 40;
        case '-' : return 41;
        case '.' : return 42;
        case '/' : return 43;
        case ':' : return 44;
        default :
          throw 'illegal char :' + c;
        }
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qr8BitByte
  //---------------------------------------------------------------------

  var qr8BitByte = function(data) {

    var _mode = QRMode.MODE_8BIT_BYTE;
    var _data = data;
    var _bytes = qrcode.stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _bytes.length;
    };

    _this.write = function(buffer) {
      for (var i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrKanji
  //---------------------------------------------------------------------

  var qrKanji = function(data) {

    var _mode = QRMode.MODE_KANJI;
    var _data = data;

    var stringToBytes = qrcode.stringToBytesFuncs['SJIS'];
    if (!stringToBytes) {
      throw 'sjis not supported.';
    }
    !function(c, code) {
      // self test for sjis support.
      var test = stringToBytes(c);
      if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {
        throw 'sjis not supported.';
      }
    }('\u53cb', 0x9746);

    var _bytes = stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return ~~(_bytes.length / 2);
    };

    _this.write = function(buffer) {

      var data = _bytes;

      var i = 0;

      while (i + 1 < data.length) {

        var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);

        if (0x8140 <= c && c <= 0x9FFC) {
          c -= 0x8140;
        } else if (0xE040 <= c && c <= 0xEBBF) {
          c -= 0xC140;
        } else {
          throw 'illegal char at ' + (i + 1) + '/' + c;
        }

        c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);

        buffer.put(c, 13);

        i += 2;
      }

      if (i < data.length) {
        throw 'illegal char at ' + (i + 1);
      }
    };

    return _this;
  };

  //=====================================================================
  // GIF Support etc.
  //

  //---------------------------------------------------------------------
  // byteArrayOutputStream
  //---------------------------------------------------------------------

  var byteArrayOutputStream = function() {

    var _bytes = [];

    var _this = {};

    _this.writeByte = function(b) {
      _bytes.push(b & 0xff);
    };

    _this.writeShort = function(i) {
      _this.writeByte(i);
      _this.writeByte(i >>> 8);
    };

    _this.writeBytes = function(b, off, len) {
      off = off || 0;
      len = len || b.length;
      for (var i = 0; i < len; i += 1) {
        _this.writeByte(b[i + off]);
      }
    };

    _this.writeString = function(s) {
      for (var i = 0; i < s.length; i += 1) {
        _this.writeByte(s.charCodeAt(i) );
      }
    };

    _this.toByteArray = function() {
      return _bytes;
    };

    _this.toString = function() {
      var s = '';
      s += '[';
      for (var i = 0; i < _bytes.length; i += 1) {
        if (i > 0) {
          s += ',';
        }
        s += _bytes[i];
      }
      s += ']';
      return s;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64EncodeOutputStream
  //---------------------------------------------------------------------

  var base64EncodeOutputStream = function() {

    var _buffer = 0;
    var _buflen = 0;
    var _length = 0;
    var _base64 = '';

    var _this = {};

    var writeEncoded = function(b) {
      _base64 += String.fromCharCode(encode(b & 0x3f) );
    };

    var encode = function(n) {
      if (n < 0) {
        // error.
      } else if (n < 26) {
        return 0x41 + n;
      } else if (n < 52) {
        return 0x61 + (n - 26);
      } else if (n < 62) {
        return 0x30 + (n - 52);
      } else if (n == 62) {
        return 0x2b;
      } else if (n == 63) {
        return 0x2f;
      }
      throw 'n:' + n;
    };

    _this.writeByte = function(n) {

      _buffer = (_buffer << 8) | (n & 0xff);
      _buflen += 8;
      _length += 1;

      while (_buflen >= 6) {
        writeEncoded(_buffer >>> (_buflen - 6) );
        _buflen -= 6;
      }
    };

    _this.flush = function() {

      if (_buflen > 0) {
        writeEncoded(_buffer << (6 - _buflen) );
        _buffer = 0;
        _buflen = 0;
      }

      if (_length % 3 != 0) {
        // padding
        var padlen = 3 - _length % 3;
        for (var i = 0; i < padlen; i += 1) {
          _base64 += '=';
        }
      }
    };

    _this.toString = function() {
      return _base64;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64DecodeInputStream
  //---------------------------------------------------------------------

  var base64DecodeInputStream = function(str) {

    var _str = str;
    var _pos = 0;
    var _buffer = 0;
    var _buflen = 0;

    var _this = {};

    _this.read = function() {

      while (_buflen < 8) {

        if (_pos >= _str.length) {
          if (_buflen == 0) {
            return -1;
          }
          throw 'unexpected end of file./' + _buflen;
        }

        var c = _str.charAt(_pos);
        _pos += 1;

        if (c == '=') {
          _buflen = 0;
          return -1;
        } else if (c.match(/^\s$/) ) {
          // ignore if whitespace.
          continue;
        }

        _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
        _buflen += 6;
      }

      var n = (_buffer >>> (_buflen - 8) ) & 0xff;
      _buflen -= 8;
      return n;
    };

    var decode = function(c) {
      if (0x41 <= c && c <= 0x5a) {
        return c - 0x41;
      } else if (0x61 <= c && c <= 0x7a) {
        return c - 0x61 + 26;
      } else if (0x30 <= c && c <= 0x39) {
        return c - 0x30 + 52;
      } else if (c == 0x2b) {
        return 62;
      } else if (c == 0x2f) {
        return 63;
      } else {
        throw 'c:' + c;
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // gifImage (B/W)
  //---------------------------------------------------------------------

  var gifImage = function(width, height) {

    var _width = width;
    var _height = height;
    var _data = new Array(width * height);

    var _this = {};

    _this.setPixel = function(x, y, pixel) {
      _data[y * _width + x] = pixel;
    };

    _this.write = function(out) {

      //---------------------------------
      // GIF Signature

      out.writeString('GIF87a');

      //---------------------------------
      // Screen Descriptor

      out.writeShort(_width);
      out.writeShort(_height);

      out.writeByte(0x80); // 2bit
      out.writeByte(0);
      out.writeByte(0);

      //---------------------------------
      // Global Color Map

      // black
      out.writeByte(0x00);
      out.writeByte(0x00);
      out.writeByte(0x00);

      // white
      out.writeByte(0xff);
      out.writeByte(0xff);
      out.writeByte(0xff);

      //---------------------------------
      // Image Descriptor

      out.writeString(',');
      out.writeShort(0);
      out.writeShort(0);
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(0);

      //---------------------------------
      // Local Color Map

      //---------------------------------
      // Raster Data

      var lzwMinCodeSize = 2;
      var raster = getLZWRaster(lzwMinCodeSize);

      out.writeByte(lzwMinCodeSize);

      var offset = 0;

      while (raster.length - offset > 255) {
        out.writeByte(255);
        out.writeBytes(raster, offset, 255);
        offset += 255;
      }

      out.writeByte(raster.length - offset);
      out.writeBytes(raster, offset, raster.length - offset);
      out.writeByte(0x00);

      //---------------------------------
      // GIF Terminator
      out.writeString(';');
    };

    var bitOutputStream = function(out) {

      var _out = out;
      var _bitLength = 0;
      var _bitBuffer = 0;

      var _this = {};

      _this.write = function(data, length) {

        if ( (data >>> length) != 0) {
          throw 'length over';
        }

        while (_bitLength + length >= 8) {
          _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
          length -= (8 - _bitLength);
          data >>>= (8 - _bitLength);
          _bitBuffer = 0;
          _bitLength = 0;
        }

        _bitBuffer = (data << _bitLength) | _bitBuffer;
        _bitLength = _bitLength + length;
      };

      _this.flush = function() {
        if (_bitLength > 0) {
          _out.writeByte(_bitBuffer);
        }
      };

      return _this;
    };

    var getLZWRaster = function(lzwMinCodeSize) {

      var clearCode = 1 << lzwMinCodeSize;
      var endCode = (1 << lzwMinCodeSize) + 1;
      var bitLength = lzwMinCodeSize + 1;

      // Setup LZWTable
      var table = lzwTable();

      for (var i = 0; i < clearCode; i += 1) {
        table.add(String.fromCharCode(i) );
      }
      table.add(String.fromCharCode(clearCode) );
      table.add(String.fromCharCode(endCode) );

      var byteOut = byteArrayOutputStream();
      var bitOut = bitOutputStream(byteOut);

      // clear code
      bitOut.write(clearCode, bitLength);

      var dataIndex = 0;

      var s = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;

      while (dataIndex < _data.length) {

        var c = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;

        if (table.contains(s + c) ) {

          s = s + c;

        } else {

          bitOut.write(table.indexOf(s), bitLength);

          if (table.size() < 0xfff) {

            if (table.size() == (1 << bitLength) ) {
              bitLength += 1;
            }

            table.add(s + c);
          }

          s = c;
        }
      }

      bitOut.write(table.indexOf(s), bitLength);

      // end code
      bitOut.write(endCode, bitLength);

      bitOut.flush();

      return byteOut.toByteArray();
    };

    var lzwTable = function() {

      var _map = {};
      var _size = 0;

      var _this = {};

      _this.add = function(key) {
        if (_this.contains(key) ) {
          throw 'dup key:' + key;
        }
        _map[key] = _size;
        _size += 1;
      };

      _this.size = function() {
        return _size;
      };

      _this.indexOf = function(key) {
        return _map[key];
      };

      _this.contains = function(key) {
        return typeof _map[key] != 'undefined';
      };

      return _this;
    };

    return _this;
  };

  var createDataURL = function(width, height, getPixel) {
    var gif = gifImage(width, height);
    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        gif.setPixel(x, y, getPixel(x, y) );
      }
    }

    var b = byteArrayOutputStream();
    gif.write(b);

    var base64 = base64EncodeOutputStream();
    var bytes = b.toByteArray();
    for (var i = 0; i < bytes.length; i += 1) {
      base64.writeByte(bytes[i]);
    }
    base64.flush();

    return 'data:image/gif;base64,' + base64;
  };

  //---------------------------------------------------------------------
  // returns qrcode function.

  return qrcode;
}();

// multibyte support
!function() {

  qrcode.stringToBytesFuncs['UTF-8'] = function(s) {
    // http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
    function toUTF8Array(str) {
      var utf8 = [];
      for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6),
              0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
          i++;
          // UTF-16 encodes 0x10000-0x10FFFF by
          // subtracting 0x10000 and splitting the
          // 20 bits of 0x0-0xFFFFF into two halves
          charcode = 0x10000 + (((charcode & 0x3ff)<<10)
            | (str.charCodeAt(i) & 0x3ff));
          utf8.push(0xf0 | (charcode >>18),
              0x80 | ((charcode>>12) & 0x3f),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
      }
      return utf8;
    }
    return toUTF8Array(s);
  };

}();
/* (UMD export footer intentionally removed — it clobbered this module's own default export) */

function QRCodeSVG({ value, size = 176 }) {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  const cell = size / count;
  const rects = [];
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        rects.push(<rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell + 0.5} height={cell + 0.5} fill="#14171c" />);
      }
    }
  }
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ background: "#ece5d3", padding: 10, borderRadius: 10 }}>{rects}</svg>;
}

/* ============================= THEME ============================= */
const ThemeStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap');
    .qc-root {
      --ink:#14171c; --ink2:#1c2027; --paper:#ece5d3; --paper-dim:#d9d0b8;
      --reform:#2f6b76; --reform-dim:#1e454c; --syndicate:#8c2a2a; --syndicate-dim:#5e1c1c;
      --gold:#b8924f; --text:#ece5d3; --text-dim:#a89f8c;
      font-family:'Source Serif 4', Georgia, serif;
      background:var(--ink); color:var(--text); min-height:100vh;
    }
    .qc-display { font-family:'Oswald', 'Arial Narrow', sans-serif; letter-spacing:0.04em; text-transform:uppercase; }
    .qc-seal { border:2px solid var(--gold); color:var(--gold); border-radius:9999px; }
    .qc-btn { font-family:'Oswald', sans-serif; letter-spacing:0.06em; text-transform:uppercase; font-weight:600;
      background:var(--gold); color:var(--ink); border:none; padding:0.75rem 1.25rem; border-radius:0.25rem;
      cursor:pointer; transition:transform .1s ease, background .15s ease; }
    .qc-btn:hover { transform:translateY(-1px); background:#cba766; }
    .qc-btn:disabled { opacity:0.35; cursor:not-allowed; transform:none; }
    .qc-btn-outline { background:transparent; border:2px solid var(--gold); color:var(--gold); }
    .qc-btn-danger { background:var(--syndicate); color:var(--text); }
    .qc-btn-reform { background:var(--reform); color:var(--text); }
    .qc-card { background:var(--paper); color:var(--ink); border-radius:0.4rem; box-shadow:0 6px 18px rgba(0,0,0,0.45); }
    .qc-slot { width:2.9rem; height:3.9rem; border-radius:0.3rem; display:flex; align-items:center; justify-content:center; font-size:0.9rem; }
    .qc-slot-big { width:4.4rem; height:5.9rem; border-radius:0.35rem; display:flex; align-items:center; justify-content:center; font-size:1.4rem; }
    .qc-slot-empty { border:2px dashed rgba(236,229,211,0.25); }
    .qc-slot-reform { background:var(--reform); }
    .qc-slot-syndicate { background:var(--syndicate); }
    .qc-slot-power { border:2px solid var(--gold); color:var(--gold); }
    .qc-input { background:var(--ink2); border:1px solid var(--text-dim); color:var(--text); padding:0.6rem 0.8rem; border-radius:0.25rem; }
    .qc-tag { font-family:'Oswald',sans-serif; font-size:0.65rem; letter-spacing:0.08em; text-transform:uppercase; padding:0.15rem 0.5rem; border-radius:9999px; }
    .qc-tag-big { font-size:0.95rem; padding:0.35rem 0.9rem; }
    .qc-fade-in { animation: qcFade .35s ease; }
    @keyframes qcFade { from { opacity:0; transform:translateY(6px);} to {opacity:1; transform:translateY(0);} }
    .qc-stamp { animation: qcStamp .4s cubic-bezier(.2,1.4,.4,1); }
    @keyframes qcStamp { 0%{ transform:scale(2.2) rotate(-8deg); opacity:0;} 60%{transform:scale(0.95) rotate(-8deg); opacity:1;} 100%{transform:scale(1) rotate(-8deg);} }
  `}</style>
);

/* ============================= GAME DATA ============================= */
// Internal keys stay 'reform' / 'syndicate' / 'boss' for game logic;
// only the on-screen labels are shown to players below.
const ROLE_SETUP = {
  5:{reform:3,syndicate:1,boss:1}, 6:{reform:4,syndicate:1,boss:1},
  7:{reform:4,syndicate:2,boss:1}, 8:{reform:5,syndicate:2,boss:1},
  9:{reform:5,syndicate:3,boss:1}, 10:{reform:6,syndicate:3,boss:1},
};
const POWER_TRACK = {
  5:[null,null,'preview','resign','resign'], 6:[null,null,'preview','resign','resign'],
  7:[null,'check','snap','resign','resign'], 8:[null,'check','snap','resign','resign'],
  9:['check','check','snap','resign','resign'], 10:['check','check','snap','resign','resign'],
};
const POWER_LABEL = { check:"Investigate Loyalty", snap:"Special Election", preview:"Policy Peek", resign:"Execution" };
const ROLE_LABEL = { reform:"Liberal", syndicate:"Fascist", boss:"Hitler" };
const TEAM_LABEL = { reform:"Liberal", syndicate:"Fascist" };
const POLICY_LABEL = { reform:"Liberal", syndicate:"Fascist" };

function shuffle(arr){ const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function makeDeck(){ return shuffle([...Array(6).fill('reform'), ...Array(11).fill('syndicate')]); }
function uid(){ return Math.random().toString(36).slice(2,10); }
function roomCodeGen(){ const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c=''; for(let i=0;i<4;i++) c+=chars[Math.floor(Math.random()*chars.length)]; return c; }

function assignRoles(players){
  const setup = ROLE_SETUP[players.length];
  const pool = shuffle([
    ...Array(setup.reform).fill('reform'),
    ...Array(setup.syndicate).fill('syndicate'),
    ...Array(setup.boss).fill('boss'),
  ]);
  return players.map((p,i)=>({...p, role:pool[i], alive:true, roleAcked:false}));
}

function aliveList(players){ return players.filter(p=>p.alive); }
function nextAliveIndexFrom(players, idx){
  const n = players.length;
  for(let step=1; step<=n; step++){
    const i = (idx+step) % n;
    if(players[i].alive) return i;
  }
  return idx;
}

function initialGameState(players, hostId, code){
  const withRoles = assignRoles(players);
  const startIdx = Math.floor(Math.random()*withRoles.length);
  return {
    code, hostId, rev:1,
    phase:'roles',
    players: withRoles,
    presidentIndex: startIdx,
    specialElectionReturnIndex: null,
    chancellorNomineeId: null,
    previousGovernment: null,
    electionTracker: 0,
    votes: {},
    deck: makeDeck(),
    discard: [],
    reformCount: 0,
    syndicateCount: 0,
    drawnCards: null,
    chancellorHand: null,
    pendingPower: null,
    pendingReveal: null,
    vetoUnlocked: false,
    vetoRequested: false,
    winner: null,
    log: [`The game begins with ${withRoles.length} players.`],
  };
}

function ensureDeck(state, need){
  let {deck, discard} = state;
  if(deck.length < need){
    deck = shuffle([...deck, ...discard]);
    discard = [];
  }
  return {deck, discard};
}

function checkPolicyWin(state){
  if(state.reformCount>=5) return {team:'reform', reason:'Five Liberal policies were enacted.'};
  if(state.syndicateCount>=6) return {team:'syndicate', reason:'Six Fascist policies were enacted.'};
  return null;
}

/* ============================= REDUCER ============================= */
function reduce(state, action){
  switch(action.type){
    case 'ACK_ROLE': {
      const players = state.players.map(p=> p.id===action.playerId ? {...p, roleAcked:true} : p);
      const allAcked = players.every(p=>p.roleAcked);
      return {...state, players, phase: allAcked ? 'nomination' : 'roles',
        log: allAcked ? [...state.log, 'All roles have been seen. Nominations begin.'] : state.log };
    }
    case 'NOMINATE': {
      const pres = state.players.find(p=>p.id===state.players[state.presidentIndex].id);
      const chan = state.players.find(p=>p.id===action.chancellorId);
      return {...state, chancellorNomineeId: action.chancellorId, phase:'voting', votes:{},
        log:[...state.log, `${pres.name} nominates ${chan.name} for Chancellor.`]};
    }
    case 'VOTE': {
      const votes = {...state.votes, [action.playerId]: action.vote};
      const alive = aliveList(state.players);
      if(Object.keys(votes).length < alive.length){
        return {...state, votes};
      }
      const yes = Object.values(votes).filter(v=>v===true).length;
      const no = Object.values(votes).filter(v=>v===false).length;
      const passed = yes > no;
      const chancellor = state.players.find(p=>p.id===state.chancellorNomineeId);
      let logMsg = `Vote: ${yes} for, ${no} against — the government ${passed ? 'is confirmed.' : 'is rejected.'}`;
      if(!passed){
        const tracker = state.electionTracker+1;
        if(tracker>=3){
          const {deck, discard} = ensureDeck(state, 1);
          const card = deck[0];
          const reformCount = state.reformCount + (card==='reform'?1:0);
          const syndicateCount = state.syndicateCount + (card==='syndicate'?1:0);
          const nextIdx = nextAliveIndexFrom(state.players, state.presidentIndex);
          const forcedState = {...state, votes, deck:deck.slice(1), discard, reformCount, syndicateCount,
            electionTracker:0, previousGovernment:null, chancellorNomineeId:null,
            presidentIndex: state.specialElectionReturnIndex ?? nextIdx,
            specialElectionReturnIndex:null,
            phase:'nomination', log:[...state.log, logMsg,
              `Three governments were rejected in a row. The top policy is enacted automatically: ${POLICY_LABEL[card]}.`]};
          const win = checkPolicyWin(forcedState);
          return win ? {...forcedState, phase:'gameover', winner:win} : maybeGrantPower(forcedState);
        }
        const nextIdx = nextAliveIndexFrom(state.players, state.presidentIndex);
        return {...state, votes, electionTracker:tracker, chancellorNomineeId:null,
          presidentIndex: state.specialElectionReturnIndex ?? nextIdx,
          specialElectionReturnIndex:null,
          phase:'nomination', log:[...state.log, logMsg]};
      }
      // passed
      if(state.syndicateCount>=3 && chancellor.role==='boss'){
        return {...state, votes, phase:'gameover',
          winner:{team:'syndicate', reason:`${chancellor.name}, Hitler, was elected Chancellor.`},
          log:[...state.log, logMsg, `${chancellor.name} was revealed to be Hitler. The Fascists seize control.`]};
      }
      const {deck, discard} = ensureDeck(state, 3);
      return {...state, votes, deck: deck.slice(3), discard, drawnCards: deck.slice(0,3),
        previousGovernment:{presidentId: state.players[state.presidentIndex].id, chancellorId: chancellor.id},
        electionTracker:0, phase:'legislative-president', log:[...state.log, logMsg]};
    }
    case 'PRESIDENT_DISCARD': {
      const drawn = [...state.drawnCards];
      const [removed] = drawn.splice(action.index,1);
      return {...state, drawnCards:null, chancellorHand: drawn, discard:[...state.discard, removed],
        phase:'legislative-chancellor'};
    }
    case 'CHANCELLOR_REQUEST_VETO': {
      return {...state, phase:'veto-president', log:[...state.log, 'The Chancellor requests to veto this agenda.']};
    }
    case 'PRESIDENT_VETO_DECISION': {
      if(action.approve){
        const tracker = state.electionTracker;
        const nextIdx = nextAliveIndexFrom(state.players, state.presidentIndex);
        return {...state, discard:[...state.discard, ...state.chancellorHand], chancellorHand:null,
          electionTracker: tracker+1, previousGovernment:null,
          presidentIndex: state.specialElectionReturnIndex ?? nextIdx, specialElectionReturnIndex:null,
          phase:'nomination', chancellorNomineeId:null,
          log:[...state.log, 'The President approves the veto. No policy is enacted.']};
      }
      return {...state, phase:'legislative-chancellor', log:[...state.log, 'The President rejects the veto. The Chancellor must enact a policy.']};
    }
    case 'CHANCELLOR_ENACT': {
      const hand = [...state.chancellorHand];
      const [enacted] = hand.splice(action.index,1);
      const reformCount = state.reformCount + (enacted==='reform'?1:0);
      const syndicateCount = state.syndicateCount + (enacted==='syndicate'?1:0);
      let next = {...state, chancellorHand:null, discard:[...state.discard, ...hand],
        reformCount, syndicateCount, vetoUnlocked: syndicateCount>=5,
        log:[...state.log, `The Chancellor enacts a ${POLICY_LABEL[enacted]} policy.`]};
      const win = checkPolicyWin(next);
      if(win) return {...next, phase:'gameover', winner:win};
      if(enacted==='syndicate') return maybeGrantPower(next);
      return advancePresidency(next);
    }
    case 'RESOLVE_REVEAL': {
      return {...state, pendingReveal:null};
    }
    case 'POWER_CHECK_AFFILIATION': {
      const target = state.players.find(p=>p.id===action.targetId);
      const president = state.players[state.presidentIndex];
      const reveal = {forPlayerId: president.id, title:'Investigate Loyalty', body:
        `${target.name}'s party membership card reads: ${TEAM_LABEL[target.role==='boss' ? 'syndicate' : target.role]}.`};
      return advancePresidency({...state, pendingPower:null, pendingReveal:reveal,
        log:[...state.log, `${president.name} investigates ${target.name}'s loyalty.`]});
    }
    case 'POWER_SNAP_ELECTION': {
      const president = state.players[state.presidentIndex];
      const target = state.players.find(p=>p.id===action.targetId);
      const targetIdx = state.players.findIndex(p=>p.id===target.id);
      const returnIdx = nextAliveIndexFrom(state.players, state.presidentIndex);
      return {...state, pendingPower:null, presidentIndex: targetIdx,
        specialElectionReturnIndex: returnIdx, phase:'nomination', chancellorNomineeId:null,
        log:[...state.log, `${president.name} calls a special election, naming ${target.name} as the next Presidential candidate.`]};
    }
    case 'POWER_PREVIEW_AGENDA': {
      const president = state.players[state.presidentIndex];
      const {deck, discard} = ensureDeck(state, 3);
      const top3 = deck.slice(0,3);
      const reveal = {forPlayerId: president.id, title:'Policy Peek', body:
        `The next three policies, in order: ${top3.map(c=>POLICY_LABEL[c]).join(', ')}.`};
      return advancePresidency({...state, deck, discard, pendingPower:null, pendingReveal:reveal,
        log:[...state.log, `${president.name} peeks at the top of the policy deck.`]});
    }
    case 'POWER_FORCE_RESIGNATION': {
      const president = state.players[state.presidentIndex];
      const target = state.players.find(p=>p.id===action.targetId);
      const players = state.players.map(p=>p.id===target.id? {...p, alive:false} : p);
      if(target.role==='boss'){
        return {...state, players, pendingPower:null, phase:'gameover',
          winner:{team:'reform', reason:`${target.name}, Hitler, was executed.`},
          log:[...state.log, `${president.name} executes ${target.name}. It was Hitler! The Liberals prevail.`]};
      }
      return advancePresidency({...state, players, pendingPower:null,
        log:[...state.log, `${president.name} executes ${target.name}.`]});
    }
    default: return state;
  }
}

function maybeGrantPower(state){
  const track = POWER_TRACK[state.players.length];
  const power = state.syndicateCount>=1 && state.syndicateCount<=5 ? track[state.syndicateCount-1] : null;
  if(power){
    return {...state, phase:'executive-power', pendingPower:power};
  }
  return advancePresidency(state);
}

function advancePresidency(state){
  const nextIdx = state.specialElectionReturnIndex ?? nextAliveIndexFrom(state.players, state.presidentIndex);
  return {...state, presidentIndex: nextIdx, specialElectionReturnIndex:null,
    phase:'nomination', chancellorNomineeId:null};
}

/* ============================= STORAGE HELPERS ============================= */
async function saveRemote(code, state){
  try { await window.storage.set(`qc-game-${code}`, JSON.stringify(state), true); } catch(e){ /* ignore */ }
}
async function loadRemote(code){
  try { const r = await window.storage.get(`qc-game-${code}`, true); return r ? JSON.parse(r.value) : null; }
  catch(e){ return null; }
}

/* ============================= APP ============================= */
export default function QuietCoup(){
  const [mode, setMode] = useState(null);
  const [roomCode, setRoomCode] = useState(null);
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [isTableDisplay, setIsTableDisplay] = useState(false);
  const [game, setGame] = useState(null);
  const [myControlledIds, setMyControlledIds] = useState([]);
  const [nameInput, setNameInput] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [pendingNames, setPendingNames] = useState([]);
  const [error, setError] = useState('');
  const [gateFor, setGateFor] = useState(null);
  const revRef = useRef(0);

  function setUrlState(params){
    try {
      const url = new URL(window.location.href);
      url.search = '';
      Object.entries(params).forEach(([k,v])=>{ if(v!=null) url.searchParams.set(k, v); });
      window.history.replaceState({}, '', url);
    } catch(e){ /* no URL access, ignore */ }
  }

  useEffect(()=>{
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const join = params.get('join');
        const as = params.get('as');
        const table = params.get('table');
        if(!join) return;
        const remote = await loadRemote(join);
        if(!remote){
          setJoinCodeInput(join.toUpperCase());
          setMode('setup-join');
          return;
        }
        if(table){
          setRoomCode(join); setIsMultiplayer(true); setIsTableDisplay(true);
          setMyControlledIds([]);
          setGame(remote); setMode(remote.phase==='lobby' ? 'lobby-wait' : 'game');
          revRef.current = remote.rev;
          return;
        }
        if(as && remote.players.find(p=>p.id===as)){
          setRoomCode(join); setIsMultiplayer(true); setIsTableDisplay(false);
          setMyControlledIds([as]);
          setGame(remote); setMode(remote.phase==='lobby' ? 'lobby-wait' : 'game');
          revRef.current = remote.rev;
          return;
        }
        // No (valid) saved identity for this room — fall back to the join screen.
        setJoinCodeInput(join.toUpperCase());
        setMode('setup-join');
      } catch(e){ /* no URL access, ignore */ }
    })();
  }, []);

  useEffect(()=>{ if(game) revRef.current = game.rev || 0; }, [game]);
  const gameRef = useRef(null);
  useEffect(()=>{ gameRef.current = game; }, [game]);

  const dispatch = useCallback(async (action) => {
    let base = gameRef.current;
    if(isMultiplayer && roomCode){
      // Always act on the freshest possible state, not a locally-cached copy
      // that might be up to one poll-interval stale — this closes almost all
      // of the window where two players acting at once could clobber each
      // other's update.
      const remote = await loadRemote(roomCode);
      if(remote) base = remote;
    }
    if(!base) return;
    const next = reduce(base, action);
    next.rev = (base.rev||0) + 1;
    gameRef.current = next;
    revRef.current = next.rev;
    setGame(next);
    if(isMultiplayer && roomCode){
      await saveRemote(roomCode, next);
    }
    setGateFor(null);
  }, [isMultiplayer, roomCode]);

  useEffect(()=>{
    if(!isMultiplayer || !roomCode) return;
    const iv = setInterval(async ()=>{
      const remote = await loadRemote(roomCode);
      if(remote && remote.rev > revRef.current){
        revRef.current = remote.rev;
        setGame(remote);
        if(remote.phase && remote.phase!=='lobby') setMode('game');
      }
    }, 1800);
    return ()=>clearInterval(iv);
  }, [isMultiplayer, roomCode]);

  function startLocalSetup(){ setMode('setup-local'); setPendingNames([]); }
  function addLocalName(){
    if(!nameInput.trim()) return;
    setPendingNames([...pendingNames, nameInput.trim()]);
    setNameInput('');
  }
  function beginLocalGame(){
    if(pendingNames.length<5) { setError('Need at least 5 players.'); return; }
    const players = pendingNames.map(n=>({id:uid(), name:n}));
    const g = initialGameState(players, players[0].id, null);
    setIsMultiplayer(false); setRoomCode(null); setIsTableDisplay(false);
    setMyControlledIds(players.map(p=>p.id));
    setGame(g); setMode('game');
  }

  async function createRoom(){
    if(!nameInput.trim()) { setError('Enter your name.'); return; }
    const code = roomCodeGen();
    const me = {id:uid(), name:nameInput.trim()};
    const lobby = {code, phase:'lobby', hostId: me.id, rev:1, players:[me]};
    await saveRemote(code, lobby);
    setRoomCode(code); setIsMultiplayer(true); setIsTableDisplay(false);
    setMyControlledIds([me.id]);
    setGame(lobby); setMode('lobby-wait');
    revRef.current = 1;
    setUrlState({join: code, as: me.id});
  }
  async function joinRoom(){
    const code = joinCodeInput.trim().toUpperCase();
    if(!code || !nameInput.trim()) { setError('Enter the room code and your name.'); return; }
    const remote = await loadRemote(code);
    if(!remote){ setError('Room not found.'); return; }
    if(remote.phase !== 'lobby'){ setError('That game has already started.'); return; }
    const me = {id:uid(), name:nameInput.trim()};
    const next = {...remote, players:[...remote.players, me], rev: remote.rev+1};
    await saveRemote(code, next);
    setRoomCode(code); setIsMultiplayer(true); setIsTableDisplay(false);
    setMyControlledIds([me.id]);
    setGame(next); setMode('lobby-wait');
    revRef.current = next.rev;
    setUrlState({join: code, as: me.id});
  }
  async function joinAsTableDisplay(){
    const code = joinCodeInput.trim().toUpperCase();
    if(!code){ setError("Enter the room code shown on a player's device."); return; }
    const remote = await loadRemote(code);
    if(!remote){ setError('Room not found.'); return; }
    setRoomCode(code); setIsMultiplayer(true); setIsTableDisplay(true);
    setMyControlledIds([]);
    setGame(remote); setMode(remote.phase==='lobby' ? 'lobby-wait' : 'game');
    revRef.current = remote.rev;
    setUrlState({join: code, table: '1'});
  }
  async function hostStartGame(){
    if(!game || game.players.length<5){ setError('Need at least 5 players.'); return; }
    const g = initialGameState(game.players, game.hostId, roomCode);
    g.rev = (game.rev||1)+1;
    await saveRemote(roomCode, g);
    setGame(g); setMode('game');
    revRef.current = g.rev;
  }

  if(!mode) return <LandingScreen onLocal={startLocalSetup} onCreate={()=>setMode('setup-create')}
      onJoin={()=>setMode('setup-join')} onTable={()=>setMode('setup-table')} />;
  if(mode==='setup-local') return <LocalSetupScreen names={pendingNames} nameInput={nameInput} setNameInput={setNameInput}
      onAdd={addLocalName} onRemove={(i)=>setPendingNames(pendingNames.filter((_,idx)=>idx!==i))} onBegin={beginLocalGame} error={error} onBack={()=>setMode(null)} />;
  if(mode==='setup-create') return <NameEntryScreen title="Create a Room" nameInput={nameInput} setNameInput={setNameInput}
      onSubmit={createRoom} error={error} onBack={()=>setMode(null)} />;
  if(mode==='setup-join') return <JoinScreen nameInput={nameInput} setNameInput={setNameInput} joinCodeInput={joinCodeInput}
      setJoinCodeInput={setJoinCodeInput} onSubmit={joinRoom} error={error} onBack={()=>setMode(null)} />;
  if(mode==='setup-table') return <TableJoinScreen joinCodeInput={joinCodeInput} setJoinCodeInput={setJoinCodeInput}
      onSubmit={joinAsTableDisplay} error={error} onBack={()=>setMode(null)} />;
  if(mode==='lobby-wait') return <LobbyWaitScreen game={game} roomCode={roomCode}
      isHost={!isTableDisplay && game.hostId && myControlledIds.includes(game.hostId)} isTableDisplay={isTableDisplay} onStart={hostStartGame} />;
  if(mode==='game' && game) return <GameScreen game={game} dispatch={dispatch} myControlledIds={myControlledIds}
      isMultiplayer={isMultiplayer} isTableDisplay={isTableDisplay} gateFor={gateFor} setGateFor={setGateFor} />;
  return null;
}

/* ============================= SCREENS ============================= */
function Frame({children, wide}){
  return <div className="qc-root"><ThemeStyles />
    <div className={`${wide ? 'max-w-4xl' : 'max-w-lg'} mx-auto px-4 py-8 min-h-screen flex flex-col transition-all`}>{children}</div>
  </div>;
}

function LandingScreen({onLocal, onCreate, onJoin, onTable}){
  return <Frame>
    <div className="flex-1 flex flex-col justify-center items-center text-center gap-8 qc-fade-in">
      <div>
        <div className="qc-tag qc-seal inline-block mb-3 px-3 py-1">A game of hidden loyalties</div>
        <h1 className="qc-display text-5xl font-bold" style={{color:'var(--gold)'}}>Secret Himmler</h1>
        <p className="mt-3 text-sm" style={{color:'var(--text-dim)'}}>Liberals versus Fascists. Trust no one. Five to ten players.</p>
      </div>
      <div className="flex flex-col gap-3 w-full">
        <button className="qc-btn" onClick={onLocal}>Play on one device</button>
        <button className="qc-btn qc-btn-outline" onClick={onCreate}>Start a room (everyone joins)</button>
        <button className="qc-btn qc-btn-outline" onClick={onJoin}>Join a room with a code</button>
        <button className="qc-btn qc-btn-outline" onClick={onTable}>Table Display (put this one in the middle)</button>
      </div>
    </div>
  </Frame>;
}

function LocalSetupScreen({names, nameInput, setNameInput, onAdd, onRemove, onBegin, error, onBack}){
  return <Frame>
    <button className="qc-tag qc-btn-outline qc-btn mb-4 self-start" onClick={onBack}>← Back</button>
    <h2 className="qc-display text-2xl mb-1" style={{color:'var(--gold)'}}>Add Players</h2>
    <p className="text-sm mb-4" style={{color:'var(--text-dim)'}}>Enter each player's name. Pass the device around during the game — you'll be prompted before any private information appears.</p>
    <div className="flex gap-2 mb-4">
      <input className="qc-input flex-1" placeholder="Player name" value={nameInput}
        onChange={e=>setNameInput(e.target.value)} onKeyDown={e=>e.key==='Enter' && onAdd()} />
      <button className="qc-btn" onClick={onAdd}>Add</button>
    </div>
    <div className="flex flex-col gap-2 mb-6">
      {names.map((n,i)=>(
        <div key={i} className="qc-card flex items-center justify-between px-3 py-2">
          <span className="qc-display text-sm">{i+1}. {n}</span>
          <button className="text-xs underline" onClick={()=>onRemove(i)} style={{color:'var(--syndicate)'}}>remove</button>
        </div>
      ))}
      {names.length===0 && <p className="text-xs" style={{color:'var(--text-dim)'}}>No players yet.</p>}
    </div>
    {error && <p className="text-sm mb-3" style={{color:'#e08787'}}>{error}</p>}
    <button className="qc-btn mt-auto" disabled={names.length<5} onClick={onBegin}>
      Begin Game {names.length<5 ? `(need ${5-names.length} more)` : `(${names.length} players)`}
    </button>
  </Frame>;
}

function NameEntryScreen({title, nameInput, setNameInput, onSubmit, error, onBack}){
  return <Frame>
    <button className="qc-tag qc-btn-outline qc-btn mb-4 self-start" onClick={onBack}>← Back</button>
    <h2 className="qc-display text-2xl mb-4" style={{color:'var(--gold)'}}>{title}</h2>
    <input className="qc-input mb-4" placeholder="Your name" value={nameInput} onChange={e=>setNameInput(e.target.value)} />
    {error && <p className="text-sm mb-3" style={{color:'#e08787'}}>{error}</p>}
    <button className="qc-btn" onClick={onSubmit}>Create Room</button>
  </Frame>;
}

function JoinScreen({nameInput, setNameInput, joinCodeInput, setJoinCodeInput, onSubmit, error, onBack}){
  return <Frame>
    <button className="qc-tag qc-btn-outline qc-btn mb-4 self-start" onClick={onBack}>← Back</button>
    <h2 className="qc-display text-2xl mb-4" style={{color:'var(--gold)'}}>Join a Room</h2>
    <input className="qc-input mb-3" placeholder="Room code" value={joinCodeInput}
      onChange={e=>setJoinCodeInput(e.target.value.toUpperCase())} />
    <input className="qc-input mb-4" placeholder="Your name" value={nameInput} onChange={e=>setNameInput(e.target.value)} />
    {error && <p className="text-sm mb-3" style={{color:'#e08787'}}>{error}</p>}
    <button className="qc-btn" onClick={onSubmit}>Join Room</button>
  </Frame>;
}

function TableJoinScreen({joinCodeInput, setJoinCodeInput, onSubmit, error, onBack}){
  return <Frame>
    <button className="qc-tag qc-btn-outline qc-btn mb-4 self-start" onClick={onBack}>← Back</button>
    <h2 className="qc-display text-2xl mb-2" style={{color:'var(--gold)'}}>Table Display</h2>
    <p className="text-sm mb-4" style={{color:'var(--text-dim)'}}>This screen will just show the board — policy tracks, president/chancellor, the log. No private info ever appears here, so it's safe to prop up in the middle of the table. Everyone still votes and views their role on their own device.</p>
    <input className="qc-input mb-4" placeholder="Room code" value={joinCodeInput}
      onChange={e=>setJoinCodeInput(e.target.value.toUpperCase())} />
    {error && <p className="text-sm mb-3" style={{color:'#e08787'}}>{error}</p>}
    <button className="qc-btn" onClick={onSubmit}>Show Board</button>
  </Frame>;
}

function LobbyWaitScreen({game, roomCode, isHost, isTableDisplay, onStart}){
  let joinValue = roomCode;
  try {
    joinValue = `${window.location.origin}${window.location.pathname}?join=${roomCode}`;
  } catch(e) { /* fall back to plain code if no URL access */ }
  return <Frame wide={isTableDisplay}>
    <div className="text-center mb-6">
      <p className="text-xs uppercase tracking-widest mb-1" style={{color:'var(--text-dim)'}}>Room Code</p>
      <p className={isTableDisplay ? "qc-display text-6xl" : "qc-display text-4xl"} style={{color:'var(--gold)'}}>{roomCode}</p>
      <div className="flex justify-center mt-3">
        <QRCodeSVG value={joinValue} size={isTableDisplay ? 220 : 160} />
      </div>
      <p className="text-xs mt-2" style={{color:'var(--text-dim)'}}>Scan to open the game with the code already filled in — or just read the code out loud.</p>
    </div>
    <div className="flex flex-col gap-2 mb-6">
      {game.players.map(p=>(
        <div key={p.id} className={`qc-card px-3 py-2 qc-display ${isTableDisplay ? 'text-xl' : 'text-sm'}`}>{p.name}</div>
      ))}
    </div>
    <p className="text-xs text-center mb-4" style={{color:'var(--text-dim)'}}>{game.players.length} joined · need at least 5</p>
    {isHost ? (
      <button className="qc-btn mt-auto" disabled={game.players.length<5} onClick={onStart}>
        {game.players.length<5 ? `Waiting for players (need ${5-game.players.length} more)` : `Start Game (${game.players.length} players)`}
      </button>
    ) : <p className="text-center text-sm mt-auto" style={{color:'var(--text-dim)'}}>Waiting for the host to start the game…</p>}
  </Frame>;
}

/* ---------- MAIN GAME SCREEN ---------- */
function GameScreen({game, dispatch, myControlledIds, isMultiplayer, isTableDisplay, gateFor, setGateFor}){
  const passAndPlay = !isMultiplayer && myControlledIds.length>1;

  if(game.phase==='gameover') return <GameOverScreen game={game} wide={isTableDisplay} />;

  // The player-facing "whose turn" for informational text (waiting panel).
  const pendingPlayerId = getPendingPlayerId(game);
  // The specific one of MY OWN controlled players who can act right now.
  // For roles/voting this lets every device act independently and simultaneously;
  // for pass-and-play (multiple controlled ids on one device) it still cycles
  // through them one at a time so people don't see each other's private info.
  const myActionId = !isTableDisplay ? getMyActionablePlayerId(game, myControlledIds) : null;
  const isMyPending = !!myActionId;

  return <Frame wide={isTableDisplay}>
    <Board game={game} big={isTableDisplay} />
    <div className="mt-4 flex-1 flex flex-col">
      {isMyPending ? (
        passAndPlay && gateFor!==myActionId ? (
          <PassGate player={game.players.find(p=>p.id===myActionId)} onReady={()=>setGateFor(myActionId)} />
        ) : (
          <PrivateAction game={game} dispatch={dispatch} playerId={myActionId} onDone={()=>setGateFor(null)} />
        )
      ) : (
        <WaitingPanel game={game} pendingPlayerId={pendingPlayerId} big={isTableDisplay} />
      )}
    </div>
    <ActivityLog log={game.log} big={isTableDisplay} />
  </Frame>;
}

// Which of MY OWN controlled player ids should act right now, if any.
function getMyActionablePlayerId(game, myControlledIds){
  if(!myControlledIds || myControlledIds.length===0) return null;
  if(game.pendingReveal) return myControlledIds.includes(game.pendingReveal.forPlayerId) ? game.pendingReveal.forPlayerId : null;
  if(game.phase==='roles'){
    return myControlledIds.find(id => {
      const p = game.players.find(pp=>pp.id===id);
      return p && !p.roleAcked;
    }) ?? null;
  }
  if(game.phase==='voting'){
    return myControlledIds.find(id => {
      const p = game.players.find(pp=>pp.id===id);
      return p && p.alive && game.votes[id]===undefined;
    }) ?? null;
  }
  if(game.phase==='nomination' || game.phase==='legislative-president' || game.phase==='veto-president' || game.phase==='executive-power'){
    const presId = game.players[game.presidentIndex].id;
    return myControlledIds.includes(presId) ? presId : null;
  }
  if(game.phase==='legislative-chancellor'){
    return myControlledIds.includes(game.chancellorNomineeId) ? game.chancellorNomineeId : null;
  }
  return null;
}

// Informational-only: who the group is currently waiting on (for the waiting panel text).
function getPendingPlayerId(game){
  if(game.pendingReveal) return game.pendingReveal.forPlayerId;
  if(game.phase==='roles'){
    const p = game.players.find(p=>!p.roleAcked);
    return p ? p.id : null;
  }
  if(game.phase==='nomination') return game.players[game.presidentIndex].id;
  if(game.phase==='voting'){
    const alive = aliveList(game.players);
    const notVoted = alive.find(p=> game.votes[p.id]===undefined);
    return notVoted ? notVoted.id : null;
  }
  if(game.phase==='legislative-president') return game.players[game.presidentIndex].id;
  if(game.phase==='legislative-chancellor') return game.chancellorNomineeId;
  if(game.phase==='veto-president') return game.players[game.presidentIndex].id;
  if(game.phase==='executive-power') return game.players[game.presidentIndex].id;
  return null;
}

function Board({game, big}){
  const track = POWER_TRACK[game.players.length];
  const titleCls = big ? "text-4xl" : "text-2xl";
  const labelCls = big ? "text-sm" : "text-sm";
  const slotCls = big ? "qc-slot-big" : "qc-slot";
  const gapCls = big ? "gap-3" : "gap-2";
  const tagCls = big ? "qc-tag qc-tag-big" : "qc-tag qc-tag-big";
  return <div className="qc-fade-in">
    <div className="flex items-center justify-between mb-4">
      <h1 className={`qc-display ${titleCls}`} style={{color:'var(--gold)'}}>Secret Himmler</h1>
      <span className={tagCls} style={{background:'var(--ink2)', color:'var(--text-dim)'}}>{aliveList(game.players).length} in play</span>
    </div>
    <div className="mb-4">
      <p className={`${labelCls} uppercase tracking-widest mb-1.5`} style={{color:'var(--reform)'}}>Liberal Policies</p>
      <div className={`flex ${gapCls}`}>
        {Array.from({length:5}).map((_,i)=>(
          <div key={i} className={`${slotCls} ${i<game.reformCount ? 'qc-slot-reform' : 'qc-slot-empty'}`} />
        ))}
      </div>
    </div>
    <div className="mb-3">
      <p className={`${labelCls} uppercase tracking-widest mb-1.5`} style={{color:'var(--syndicate)'}}>Fascist Policies</p>
      <div className={`flex ${gapCls}`}>
        {Array.from({length:6}).map((_,i)=>{
          const filled = i<game.syndicateCount;
          const power = i<5 ? track[i] : null;
          return <div key={i} className={`${slotCls} ${filled ? 'qc-slot-syndicate' : (power ? 'qc-slot-power' : 'qc-slot-empty')}`}>
            {!filled && power ? powerIcon(power) : ''}
          </div>;
        })}
      </div>
      <PowerLegend track={track} big={big} />
    </div>
    <div className="flex items-center gap-2 mt-3">
      <span className={labelCls} style={{color:'var(--text-dim)'}}>Election tracker:</span>
      {[0,1,2].map(i=>(
        <div key={i} className={big ? "w-5 h-5 rounded-full" : "w-3 h-3 rounded-full"} style={{background: i<game.electionTracker ? 'var(--gold)' : 'transparent', border:'1px solid var(--gold)'}} />
      ))}
    </div>
    <div className={`flex flex-wrap ${big ? 'gap-2.5 mt-5' : 'gap-1.5 mt-3'}`}>
      {game.players.map(p=>{
        const isPres = game.players[game.presidentIndex].id===p.id;
        const isChan = game.chancellorNomineeId===p.id;
        return <span key={p.id} className={tagCls} style={{
          background: !p.alive ? 'var(--ink2)' : (isPres ? 'var(--gold)' : isChan ? 'var(--reform)' : 'var(--ink2)'),
          color: !p.alive ? 'var(--text-dim)' : (isPres ? 'var(--ink)' : 'var(--text)'),
          textDecoration: p.alive ? 'none' : 'line-through',
        }}>{p.name}{isPres ? ' · Pres' : ''}{isChan ? ' · Chan' : ''}</span>;
      })}
    </div>
  </div>;
}
function powerIcon(power){
  return {check:'👁', snap:'⚡', preview:'🔎', resign:'✕'}[power] || '';
}

const POWER_EXPLAIN = {
  check: 'President secretly checks one player’s party membership.',
  snap: 'President immediately names the next Presidential candidate.',
  preview: 'President secretly peeks at the top 3 policies in the deck.',
  resign: 'President executes a player — if it’s Hitler, Liberals win instantly.',
};

function PowerLegend({track, big}){
  const seen = new Set();
  const items = track
    .map((power, i) => ({ power, position: i+1 }))
    .filter(({power}) => power && !seen.has(power) && seen.add(power));
  if(items.length===0 && true){
    // still show veto note even with no other powers unlocked yet
  }
  const textCls = big ? "text-base" : "text-xs";
  const iconCls = big ? "text-2xl" : "text-base";
  return <div className={`mt-3 flex flex-col ${big ? 'gap-2.5' : 'gap-1.5'}`}>
    {items.map(({power, position}) => (
      <div key={power} className="flex items-start gap-2">
        <span className={iconCls} style={{lineHeight:1}}>{powerIcon(power)}</span>
        <span className={textCls} style={{color:'var(--text-dim)'}}>
          <b style={{color:'var(--gold)'}}>{ordinal(position)} fascist policy</b> — {POWER_EXPLAIN[power]}
        </span>
      </div>
    ))}
    <div className="flex items-start gap-2">
      <span className={iconCls} style={{lineHeight:1}}>🤝</span>
      <span className={textCls} style={{color:'var(--text-dim)'}}>
        <b style={{color:'var(--gold)'}}>From the 5th fascist policy onward</b> — the Chancellor may request a veto; if the President agrees, that agenda is discarded and no policy is enacted.
      </span>
    </div>
  </div>;
}
function ordinal(n){
  return {1:'1st',2:'2nd',3:'3rd',4:'4th',5:'5th'}[n] || `${n}th`;
}

function PassGate({player, onReady}){
  return <div className="qc-fade-in flex-1 flex flex-col items-center justify-center text-center gap-4">
    <p className="text-xs uppercase tracking-widest" style={{color:'var(--text-dim)'}}>Pass the device to</p>
    <p className="qc-display text-3xl" style={{color:'var(--gold)'}}>{player.name}</p>
    <button className="qc-btn" onClick={onReady}>I'm {player.name} — Show Me</button>
  </div>;
}

function WaitingPanel({game, pendingPlayerId, big}){
  const pendingPlayer = game.players.find(p=>p.id===pendingPlayerId);
  let text = 'Waiting…';
  if(game.phase==='nomination') text = `${pendingPlayer?.name} is choosing a Chancellor nominee…`;
  else if(game.phase==='voting') text = `Waiting on votes… (${Object.keys(game.votes).length}/${aliveList(game.players).length})`;
  else if(game.phase==='legislative-president') text = `${pendingPlayer?.name} (President) is reviewing policies…`;
  else if(game.phase==='legislative-chancellor') text = `${pendingPlayer?.name} (Chancellor) is reviewing policies…`;
  else if(game.phase==='veto-president') text = `${pendingPlayer?.name} (President) is deciding on the veto…`;
  else if(game.phase==='executive-power') text = `${pendingPlayer?.name} is using an executive power…`;
  else if(game.phase==='roles') text = `Waiting for everyone to view their role…`;
  return <div className="qc-fade-in flex-1 flex items-center justify-center text-center">
    <p className={big ? "text-2xl" : "text-sm"} style={{color:'var(--text-dim)'}}>{text}</p>
  </div>;
}

function ActivityLog({log, big}){
  const last = log.slice(big ? -6 : -4);
  return <div className="mt-4 pt-3" style={{borderTop:'1px solid rgba(236,229,211,0.15)'}}>
    <p className={`${big ? 'text-sm' : 'text-xs'} uppercase tracking-widest mb-1`} style={{color:'var(--text-dim)'}}>Record</p>
    <div className="flex flex-col gap-1">
      {last.map((l,i)=><p key={i} className={big ? "text-base" : "text-xs"} style={{color:'var(--text-dim)'}}>{l}</p>)}
    </div>
  </div>;
}

/* ---------- PRIVATE ACTION ROUTER ---------- */
function PrivateAction({game, dispatch, playerId, onDone}){
  const player = game.players.find(p=>p.id===playerId);

  if(game.pendingReveal && game.pendingReveal.forPlayerId===playerId){
    return <RevealCard reveal={game.pendingReveal} onDismiss={()=>{ dispatch({type:'RESOLVE_REVEAL'}); onDone(); }} />;
  }
  if(game.phase==='roles'){
    return <RoleReveal game={game} player={player} onAck={()=>{ dispatch({type:'ACK_ROLE', playerId}); onDone(); }} />;
  }
  if(game.phase==='nomination'){
    return <NominationPanel game={game} onNominate={(id)=>{ dispatch({type:'NOMINATE', chancellorId:id}); onDone(); }} />;
  }
  if(game.phase==='voting'){
    return <VotePanel player={player} onVote={(v)=>{ dispatch({type:'VOTE', playerId, vote:v}); onDone(); }} />;
  }
  if(game.phase==='legislative-president'){
    return <PresidentDiscard cards={game.drawnCards} onDiscard={(i)=>{ dispatch({type:'PRESIDENT_DISCARD', index:i}); onDone(); }} />;
  }
  if(game.phase==='legislative-chancellor'){
    return <ChancellorEnact cards={game.chancellorHand} canVeto={game.vetoUnlocked}
      onEnact={(i)=>{ dispatch({type:'CHANCELLOR_ENACT', index:i}); onDone(); }}
      onVeto={()=>{ dispatch({type:'CHANCELLOR_REQUEST_VETO'}); onDone(); }} />;
  }
  if(game.phase==='veto-president'){
    return <VetoDecision onDecide={(approve)=>{ dispatch({type:'PRESIDENT_VETO_DECISION', approve}); onDone(); }} />;
  }
  if(game.phase==='executive-power'){
    return <ExecutivePower game={game} power={game.pendingPower} onResolve={(action)=>{ dispatch(action); onDone(); }} />;
  }
  return null;
}

function RoleReveal({game, player, onAck}){
  const [shown, setShown] = useState(false);
  const teammates = (player.role==='syndicate' || player.role==='boss')
    ? game.players.filter(p=>p.id!==player.id && (p.role==='syndicate' || p.role==='boss'))
    : [];
  const showHitlerName = player.role==='syndicate' && game.players.length<=6;
  const hitlerSeesTeam = player.role==='boss' && game.players.length<=6;
  const showTeammatesToMe = player.role==='syndicate' || hitlerSeesTeam;
  return <div className="qc-fade-in flex-1 flex flex-col items-center justify-center text-center gap-4">
    {!shown ? (
      <>
        <p className="text-xs uppercase tracking-widest" style={{color:'var(--text-dim)'}}>{player.name}, ready to see your role?</p>
        <button className="qc-btn" onClick={()=>setShown(true)}>Reveal My Role</button>
      </>
    ) : (
      <div className="qc-card qc-stamp p-6 w-full">
        <p className="text-xs uppercase tracking-widest" style={{color:'var(--text-dim)'}}>You are</p>
        <p className="qc-display text-3xl mb-2" style={{color: player.role==='reform' ? 'var(--reform)' : 'var(--syndicate)'}}>{ROLE_LABEL[player.role]}</p>
        {showTeammatesToMe && teammates.length>0 && <p className="text-sm mt-2">Your fellow Fascists: <b>{teammates.map(t=>t.name).join(', ')}</b>{showHitlerName ? ' (includes Hitler)' : ''}</p>}
        {player.role==='boss' && game.players.length>=7 && <p className="text-sm mt-2">The Fascists know who you are, but you don't know them.</p>}
        <button className="qc-btn mt-4 w-full" onClick={onAck}>Got It — Hide &amp; Pass</button>
      </div>
    )}
  </div>;
}

function NominationPanel({game, onNominate}){
  const president = game.players[game.presidentIndex];
  const termLimited = new Set();
  if(game.previousGovernment){
    termLimited.add(game.previousGovernment.chancellorId);
    if(aliveList(game.players).length>5) termLimited.add(game.previousGovernment.presidentId);
  }
  const eligible = aliveList(game.players).filter(p=>p.id!==president.id && !termLimited.has(p.id));
  return <div className="qc-fade-in flex-1 flex flex-col gap-3">
    <p className="text-xs uppercase tracking-widest text-center" style={{color:'var(--text-dim)'}}>{president.name}, nominate a Chancellor</p>
    {eligible.map(p=>(
      <button key={p.id} className="qc-btn qc-btn-outline" onClick={()=>onNominate(p.id)}>{p.name}</button>
    ))}
  </div>;
}

function VotePanel({player, onVote}){
  return <div className="qc-fade-in flex-1 flex flex-col items-center justify-center gap-4">
    <p className="text-xs uppercase tracking-widest" style={{color:'var(--text-dim)'}}>{player.name}, cast your vote</p>
    <div className="flex gap-3 w-full">
      <button className="qc-btn qc-btn-reform flex-1" onClick={()=>onVote(true)}>Ja (Approve)</button>
      <button className="qc-btn qc-btn-danger flex-1" onClick={()=>onVote(false)}>Nein (Reject)</button>
    </div>
  </div>;
}

function PolicyCard({type}){
  return <div className="qc-card p-4 text-center flex-1" style={{background: type==='reform' ? 'var(--reform)' : 'var(--syndicate)', color:'var(--text)'}}>
    <p className="qc-display text-sm">{POLICY_LABEL[type]}</p>
  </div>;
}

function PresidentDiscard({cards, onDiscard}){
  return <div className="qc-fade-in flex-1 flex flex-col gap-3">
    <p className="text-xs uppercase tracking-widest text-center" style={{color:'var(--text-dim)'}}>Discard one policy (it stays secret)</p>
    <div className="flex gap-2">
      {cards.map((c,i)=>(
        <button key={i} onClick={()=>onDiscard(i)} className="flex-1"><PolicyCard type={c} /></button>
      ))}
    </div>
  </div>;
}

function ChancellorEnact({cards, canVeto, onEnact, onVeto}){
  return <div className="qc-fade-in flex-1 flex flex-col gap-3">
    <p className="text-xs uppercase tracking-widest text-center" style={{color:'var(--text-dim)'}}>Choose one policy to enact</p>
    <div className="flex gap-2">
      {cards.map((c,i)=>(
        <button key={i} onClick={()=>onEnact(i)} className="flex-1"><PolicyCard type={c} /></button>
      ))}
    </div>
    {canVeto && <button className="qc-btn qc-btn-outline" onClick={onVeto}>Request Veto Instead</button>}
  </div>;
}

function VetoDecision({onDecide}){
  return <div className="qc-fade-in flex-1 flex flex-col items-center justify-center gap-4">
    <p className="text-xs uppercase tracking-widest" style={{color:'var(--text-dim)'}}>The Chancellor requests a veto. Do you approve?</p>
    <div className="flex gap-3 w-full">
      <button className="qc-btn qc-btn-reform flex-1" onClick={()=>onDecide(true)}>Approve Veto</button>
      <button className="qc-btn qc-btn-danger flex-1" onClick={()=>onDecide(false)}>Reject Veto</button>
    </div>
  </div>;
}

function ExecutivePower({game, power, onResolve}){
  const president = game.players[game.presidentIndex];
  const targets = aliveList(game.players).filter(p=>p.id!==president.id);
  if(power==='preview'){
    return <div className="qc-fade-in flex-1 flex flex-col items-center justify-center gap-4 text-center">
      <p className="text-xs uppercase tracking-widest" style={{color:'var(--text-dim)'}}>Executive Power: {POWER_LABEL[power]}</p>
      <button className="qc-btn" onClick={()=>onResolve({type:'POWER_PREVIEW_AGENDA'})}>Peek at the Top 3 Policies</button>
    </div>;
  }
  const label = power==='check' ? 'Choose a player to investigate' : power==='snap' ? 'Choose the next Presidential candidate' : 'Choose a player to execute';
  const actionType = power==='check' ? 'POWER_CHECK_AFFILIATION' : power==='snap' ? 'POWER_SNAP_ELECTION' : 'POWER_FORCE_RESIGNATION';
  return <div className="qc-fade-in flex-1 flex flex-col gap-3">
    <p className="text-xs uppercase tracking-widest text-center" style={{color:'var(--text-dim)'}}>Executive Power: {POWER_LABEL[power]}</p>
    <p className="text-sm text-center" style={{color:'var(--text-dim)'}}>{label}</p>
    {targets.map(p=>(
      <button key={p.id} className="qc-btn qc-btn-outline" onClick={()=>onResolve({type:actionType, targetId:p.id})}>{p.name}</button>
    ))}
  </div>;
}

function RevealCard({reveal, onDismiss}){
  return <div className="qc-fade-in flex-1 flex flex-col items-center justify-center text-center gap-4">
    <div className="qc-card qc-stamp p-6 w-full">
      <p className="text-xs uppercase tracking-widest" style={{color:'var(--text-dim)'}}>{reveal.title}</p>
      <p className="text-lg mt-2">{reveal.body}</p>
      <button className="qc-btn mt-4 w-full" onClick={onDismiss}>Hide &amp; Continue</button>
    </div>
  </div>;
}

function GameOverScreen({game, wide}){
  const win = game.winner;
  return <Frame wide={wide}>
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 qc-fade-in">
      <p className="qc-tag qc-seal px-3 py-1">Game Over</p>
      <h2 className={wide ? "qc-display text-5xl" : "qc-display text-3xl"} style={{color: win.team==='reform' ? 'var(--reform)' : 'var(--syndicate)'}}>
        {win.team==='reform' ? 'The Liberals Win' : 'The Fascists Win'}
      </h2>
      <p className={wide ? "text-lg" : "text-sm"} style={{color:'var(--text-dim)'}}>{win.reason}</p>
      <div className="qc-card p-4 w-full text-left mt-4">
        <p className="qc-display text-xs mb-2" style={{color:'var(--text-dim)'}}>Final Roles</p>
        {game.players.map(p=>(
          <p key={p.id} className={wide ? "text-lg" : "text-sm"}>{p.name} — <b>{ROLE_LABEL[p.role]}</b>{!p.alive ? ' (executed)' : ''}</p>
        ))}
      </div>
    </div>
  </Frame>;
}
