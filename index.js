/**
 * Created by Will Bean on 2016/12/9.
 */
var http = require("http"),
    fs = require("fs"),
    url = require('url'),
    cheerio = require("cheerio"),
    request = require("request"),
    async = require("async"),
    phantom = require("phantom"),
    publicAPI = require("./publicAPI");

var config = {
    url: "http://localhost:8081/dhay/",//目的网站
    savePath: "J:/nodejs/open-source-spider",//保存路径
    containOutLink: false, //是否爬取外部链接
    subOnly: true,//仅爬取当前路径和其子页面
    totalNum: 10, //爬取页面上限，0为不限制
    endWith: "html",//文件结尾
    saveStrategy: publicAPI.Strategy.SAVE_IN_ROOT,
    getOuterJs: false,//是否爬取远端js
    getOuterCss: false,//是否爬取远端Css
    getOuterImages: false//是否爬取远端图片
};

var list = [config.url];
var count = 0;
var date = null;
var urlInfo = url.parse(config.url);

var requirePage = function (url) {
    date = new Date();
    phantom.create().then(function (ph) {
        publicAPI.timer(date,"phantom create 用时");
        date = new Date();
        ph.createPage().then(function (page) {
            publicAPI.timer(date,"phantom createPage 用时");
            date = new Date();
            page.open(url).then(function (status) {
                publicAPI.timer(date,"page open 用时");
                if (status == 'success') {
                    date = new Date();
                    page.property('content').then(function (html) {
                        publicAPI.timer(date,"phantom content 用时");
                        var $ = cheerio.load(html);
                        var js, css , images;

                        //获取js列表
                        var scripts = $("script");
                        js = getJs(scripts);
                        console.log(js);
                        //获取css
                        var stylesheets = $("link[rel='stylesheet']");
                        css = getCss(stylesheets);
                        console.log(css);
                        //获取图片
                        var imgs = $("img");
                        images = getImages(imgs);
                        console.log(images);
                        //获取链接
                        if(!config.totalNum || count < config.totalNum){
                            var links = $("a");
                            getLink(links,url);
                        }

                        async.parallel([
                            function (callback) {
                                saveHtml(url, html, function () {
                                    console.log("Page:"+(count+1)+"    Url:"+url+"    success!\n");
                                    callback(null);
                                });
                            },
                            function (callback) {
                                saveJs(url,js, function (x, js) {
                                    console.log("Page:"+(count+1)+"    Js"+(x+1)+"     Src:"+js+"    Success!\n");
                                },callback);
                            },
                            function (callback) {
                                saveCss(url, css, function (x, css) {
                                    console.log("Page:"+(count+1)+"    Css"+(x+1)+"     Src:"+css+"    Success!\n");
                                },callback);
                            },
                            function (callback) {
                                saveImage(url, images, function (x,img) {
                                    console.log("Page:"+(count+1)+"    Images"+(x+1)+"     Src:"+img+"    Success!\n");
                                },callback);
                            }
                        ],function (err) {
                            page.close();
                            if(err){
                                console.log(err,"ERROR IN PARALLEL PAGE "+(count+1));
                            }else {
                                count++;
                                console.log("Page:"+(count)+" finished!");
                                var cur = list.shift(),next = list[0];
                                next = /^https?:/.test(next) ? next : cur+'/'+next;
                                if( count < config.totalNum)
                                    requirePage(next);
                            }
                        })
                    })
                } else {
                    console.log("page open error!");console.log(url);
                    page.close();
                }
                ph.exit();
            })
        })
    });
};

var saveHtml = function (url, html, callback) {
    url = url.match(/https?:\/\/((?:(?![\?])[\S])*)/)[1];
    var endWith = /\/$/.test(url);
    url = endWith ? url.match(/(\S*)\/$/)[1] : url;
    var reg = new RegExp(/\.html|\.htm|\.asp|\.jsp$/);
    var usePathAsName = reg.test(url);
    var array = url.split("/");
    array[0] = urlInfo.hostname;
    var length = usePathAsName ? array.length-1: array.length;
    var currentPath = config.savePath;

    for (var i = 0; i < length; i++) {
        (function (i) {
            currentPath += "/" + array[i];
            if (fs.existsSync(currentPath)) {
                write(i, callback)
            } else {
                try {
                    fs.mkdirSync(currentPath);
                    write(i, callback)
                }catch (err){
                    console.log(err);
                }
            }
        })(i)
    }

    function write(index, callback) {
        if (index == length - 1) {
            var fileName = endWith ? "index." + config.endWith : usePathAsName ? array[array.length-1] : array[array.length-1] + config.endWith;
            console.log(currentPath);console.log(fileName);
            fs.writeFile(currentPath + "/" + fileName, html, function (err) {
                if (err) {
                    console.log(err, "appendFile");
                } else {
                    callback();
                }
            });
        }
    }
};

var saveJs = function (url, js, callback ,callback2) {
    if(!js.length){
        callback2(null);
        return;
    }
    var length = js.length;
    var count = 0;
    var root = config.savePath + "/" + urlInfo.hostname;
    if(config.saveStrategy == publicAPI.Strategy.SAVE_IN_ROOT){
        if(fs.existsSync(root)){
            write(callback,callback2)
        }else{
            fs.mkdirSync(root);
            write(callback,callback2)
        }
    }

    function write(callback,callback2) {
        for(var i = 0;i<length;i++){
            (function (i) {
                var reg = new RegExp(/^\//);
                var path = reg.test(js[i]) ? js[i].substring(1) : js[i];
                var array = path.split("/");
                var currentPath = root;
                var len = array.length;
                for(var j =0;j<len-1;j++){
                    (function (j) {
                        currentPath += "/" + array[j];
                        if (fs.existsSync(currentPath)) {
                            if(j == len-2){
                                fetch(js[i],function () {
                                    callback(count, js[i])
                                },callback2)
                            }
                        } else {
                            try {
                                fs.mkdirSync(currentPath);console.log(j,4);
                                if(j == len-2){
                                    fetch(js[i],function () {
                                        callback(count, js[i])
                                    },callback2)
                                }
                            }catch (err){
                                console.log("error!")
                            }
                        }
                    })(j);
                }
            })(i);
        }
    }

    function fetch(js,callback,callback2) {
        request(url+js,function (err,res,body) {
            //console.log(body);
            js = js.match(/((?:(?![\?])[\S])*)/)[1];
            if(err){
                count++;
            }else{
                fs.writeFile(root +"/"+ js,body,function (err) {
                    count++;
                    if(count == length)
                        callback2(null);
                    if(err){
                        console.log(err);
                    }else{
                        callback();
                    }
                });

            }
        })
    }
};

var saveCss = function (url, css, callback,callback2) {
    if(!css.length){
        callback2(null);
        return;
    }
    var length = css.length;
    var count = 0;
    var root = config.savePath + "/" + urlInfo.hostname;
    if(config.saveStrategy == publicAPI.Strategy.SAVE_IN_ROOT){
        if(fs.existsSync(root)){
            write(callback,callback2)
        }else{
            fs.mkdirSync(root);
            write(callback,callback2)
        }
    }

    function write(callback,callback2) {
        for(var i = 0;i<length;i++){
            (function (i) {
                var reg = new RegExp(/^\//);
                var path = reg.test(css[i]) ? css[i].substring(1) : css[i];
                var array = path.split("/");
                var currentPath = root;
                var len = array.length;
                for(var j =0;j<len-1;j++){
                    (function (j) {
                        currentPath += "/" + array[j];
                        if (fs.existsSync(currentPath)) {
                            if(j == len-2){
                                fetch(css[i],function () {
                                    callback(count, css[i])
                                },callback2)
                            }
                        } else {
                            try {
                                fs.mkdirSync(currentPath);console.log(j,4);
                                if(j == len-2){
                                    fetch(css[i],function () {
                                        callback(count, css[i])
                                    },callback2)
                                }
                            }catch (err){
                                console.log("error!")
                            }
                        }
                    })(j);
                }
            })(i);
        }
    }

    function fetch(js,callback,callback2) {
        request(url+js,function (err,res,body) {
            js = js.match(/((?:(?![\?])[\S])*)/)[1];
            if(err){
                count++;
            }else{
                fs.writeFile(root +"/"+ js,body,function (err) {
                    count++;
                    if(count == length)
                        callback2(null);
                    if(err){
                        console.log(err);
                    }else{
                        callback();
                    }
                });

            }
        })
    }
};

var saveImage = function (url, images, callback,callback2) {
    if(!images.length){
        callback2(null);
        return;
    }
    var length = images.length;
    var count = 0;
    var root = config.savePath + "/" + urlInfo.hostname;
    if(config.saveStrategy == publicAPI.Strategy.SAVE_IN_ROOT){
        if(fs.existsSync(root)){
            write(callback,callback2)
        }else{
            fs.mkdirSync(root);
            write(callback,callback2)
        }
    }

    function write(callback,callback2) {
        for(var i = 0;i<length;i++){
            (function (i) {
                var reg = new RegExp(/^\//);
                var path = reg.test(images[i]) ? images[i].substring(1) : images[i];
                var array = path.split("/");
                var currentPath = root;
                var len = array.length;
                for(var j =0;j<len-1;j++){
                    (function (j) {
                        currentPath += "/" + array[j];
                        if (fs.existsSync(currentPath)) {
                            if(j == len-2){
                                fetch(images[i],function () {
                                    callback(count,images[i]);
                                },callback2)
                            }
                        } else {
                            try {
                                fs.mkdirSync(currentPath);
                                if(j == len-2){
                                    fetch(images[i],function () {
                                        callback(count,images[1]);
                                    },callback2)
                                }
                            }catch (err){
                                console.log("error!")
                            }
                        }
                    })(j);
                }
            })(i);
        }
    }

    function fetch(js,callback,callback2) {
        request.get(url+js).on("response",function (res) {
            if(res.statusCode == 200){
                callback();
                count++;
                if(count == length)
                    callback2(null);
            }
        }).on("error",function (err) {
            console.log(err)
        }).pipe(fs.createWriteStream(root +"/"+ js));
    }
};

requirePage(list[0])

function getJs(scripts) {
    var res = [];
    scripts.each(function (i, script) {
        var src = script.attribs.src;
        if (!src)
            return;
        if (!config.getOuterJs) {
            if (/^https?/.test(src))
                return;
        }
        res.push(src);
    });
    return publicAPI.uniqueArray(res);
}

function getCss(stylesheets) {
    var res = [];
    stylesheets.each(function (i, style) {
        var src = style.attribs.href;
        if (!src)
            return;
        if (!config.getOuterCss) {
            if (/^https?/.test(src))
                return;
        }
        res.push(src);
    });
    return publicAPI.uniqueArray(res);
}

function getImages(imgs) {
    var res = [];
    imgs.each(function (i, img) {
        var src = img.attribs.src;
        if (!src)
            return;
        if (!config.getOuterImages) {
            if (/^https?/.test(src))
                return;
        }
        res.push(src);
    });
    return publicAPI.uniqueArray(res);
}

function getLink(links,url) {//console.log(links)
    links.each(function (i, link) {
        var href = link.attribs.href;
        if(!href) return;
        if(!config.containOutLink && /^https?/.test(href) && href.indexOf(urlInfo.hostname) < 0){
            return;
        }
        if(!config.totalNum || count < config.totalNum){
            if(!/^https?/.test(href) ){
                if(!/\.html|\.htm|\.asp|\.jsp$/.test(url))
                    href = url + "/" + href;
                else {
                    href = url.substring(0,url.lastIndexOf("/")) + "/" + href;
                }
            }
            if(linkCheck(href))
                list.push(urlFormat(href));
        }
    });
    list = publicAPI.uniqueArray(list);
    console.log(list);
}

function linkCheck(link) {
    if(link == "/") return false;
    return !/^#|javascript:|mailto:|tel:/.test(link);
}

function urlFormat(url) {//去除多于的/
    return url.replace(/([^:])[\/\\\\]{2,}/g,"$1/")
}