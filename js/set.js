/*
作者: imsyy
主页：https://www.imsyy.top/
GitHub：https://github.com/imsyy/home
版权所有，请勿删除
*/

/* 自定义配置 */
/* 尚未完善 */
$(function () {
    let url = "../setting.json"
    $.getJSON(
        url,
        function (data) {
            /* 页头数据 */
            $('title').text(data.title);
            $('#loading-title').html(data.title);
            $("meta[name='description']").attr('content', data.description);
            $("meta[name='keywords']").attr('content', data.keywords);
            $("meta[name='author']").attr('content', data.author);
            /* 基础信息 */
            $("#logo-img").attr("src", data.logo_img);
            $('#logo-text-1').html(data.logo_text_1);
            $('#logo-text-2').html("." + data.logo_text_2);
            $('#logo-title-other').html(data.logo_text_1);
            $('#logo-title-other-small').html("." + data.logo_text_2);
            $('#logo-text-small').html(data.logo_text_1 + "." + data.logo_text_2);
            /* 社交链接 */
            /* 快捷链接 */
            if (data.link_2) {
                $('#link-url-2').attr('href', data.link_2[0]);
                $('#link-icon-2').attr('class', data.link_2[1]);
                $('#link-name-2').html(data.link_2[2]);
            }
            //页脚版权
        }
    )
});

// 背景图片 Cookies 
function setBgImg(bg_img) {
    if (bg_img) {
        Cookies.set('bg_img', bg_img, {
            expires: 36500
        });
        return true;
    }
    return false;
};

// 获取背景图片 Cookies
function getBgImg() {
    let bg_img_local = Cookies.get('bg_img');
    if (bg_img_local && bg_img_local !== "{}") {
        return JSON.parse(bg_img_local);
    } else {
        setBgImg(bg_img_preinstall);
        return bg_img_preinstall;
    }
}

let bg_img_preinstall = {
    "type": "1", // 1:默认背景 2:每日一图 3:随机风景 4:随机动漫
};

// 更改背景图片
function setBgImgInit() {
    let bg_img = getBgImg();
    $("input[name='wallpaper-type'][value=" + bg_img["type"] + "]").click();

    switch (bg_img["type"]) {
        case "1":
            $('#bg').attr('src', `./img/background${1 + ~~(Math.random() * 11)}.jpg`) //随机默认壁纸
            break;
    }
};

$(document).ready(function () {
    // 壁纸数据加载
    setBgImgInit();
    // 设置背景图片
    $("#wallpaper").on("click", ".set-wallpaper", function () {
        let type = $(this).val();
        let bg_img = getBgImg();
        bg_img["type"] = type;
        iziToast.show({
            icon: "fa-solid fa-image",
            timeout: 2500,
            message: '壁纸设置成功，刷新后生效',
        });
        setBgImg(bg_img);
    });
});