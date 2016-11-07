'use strict';

var through = require('through2');
var m2c = require('./m2c.js');

var gutil = require('gulp-util');
var _ = require('./util.js');
var lang = require('./lang.js');

function parser(file, cb) {
    var extname = _.extname(file.path);

    if (_.isJs(extname) && !_.isHtml(extname)) {
        parseJS(file, cb);
    }

    if (_.isHtml(extname)) {
        parseHtml(file, cb);
    }
}

function parseHtml(file) {
    var deps = [],
        depsOrder = {},
        count = 0,
        contents,
        regExp = /<(script) .*?data-main.*?>([\s\S]*?)<\/\1>/mig;

    if (file.cache && file.cache.enable) {

        file.cache.getConfig(function (err, config) {
            if (err) {
                config = {};
            }
            file.deps = config.requires || [];
            file.depsOrder = config.depsOrder || {};
        });

    } else {
        contents = file.contents.toString();

        contents = contents.replace(regExp, function () {
            var content = arguments[2],
                nContent = lang.depsEmbed.wrap(file.path + count),
                ret;

            count++;

            ret = m2c({
                src: file.path,
                based: file.cwd,
                content: content,
                isWrap: false
            });

            depsOrder[nContent] = ret.deps;
            if (ret.content.replace(/[\s;,]/gm, '')) {
                nContent = nContent + ('\n<script' + ' type="text/javascript">\n' + ret.content + '\n</' + 'script>');
            }

            deps = deps.concat(ret.deps);
            return nContent;

        });
        file.contents = new Buffer(contents);
        file.deps = deps;
        file.depsOrder = depsOrder;
        file.cache.addModuleDeps(file.deps);
        file.cache.depsOrder = depsOrder;

    }

}

function parseJS(file, cb) {
    var ret,
        contents,
        regExp = /\'use module\';/gim;

    if (file.cache && file.cache.enable) {
        file.cache.getConfig(function (err, config) {

            if (err) {
                config = {};
            }
            file.deps = config.requires || [];
        });

    } else {
        contents = file.contents.toString();

        if (!(regExp.test(contents))) {

            return;
        }
        ret = m2c({
            src: file.path,
            based: file.cwd,
            content: contents.replace(regExp, ''),
            isWrap: true
        });
        if (ret) {
            file.contents = new Buffer(ret.content);

            file.deps = ret.deps;
            file.cache.addModuleDeps(file.deps);
        }
    }

}

module.exports = function () {
    return through.obj(function (file, enc, cb) {
        if (file.isNull()) {
            this.push(file);
            return cb();
        }

        if (file.isBuffer()) {
            try {
                parser(file);

            } catch (e) {
                return cb(new gutil.PluginError('mod', e.message));
            }
        }
        this.push(file);
        return cb();
    });
};