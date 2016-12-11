/**
 * Created by Will Bean on 2016/12/10.
 */
exports.Strategy = {//js,css,images等文件的保存策略
    "SAVE_IN_ROOT": 1,//保存在根目录下
    "SAVE_IN_SUB_DIR": 2//保存在各级子目录下
};

exports.uniqueArray = function (arr) {//数组去重
    var hash = {},
        len = arr.length,
        result = [];

    for (var i = 0; i < len; i++){
        if (!hash[arr[i]]){
            hash[arr[i]] = true;
            result.push(arr[i]);
        }
    }
    return result;
};

exports.timer = function (date,msg) {//简易版计时器
    console.log(msg + " : "+(new Date() - date) +"ms" );
};

