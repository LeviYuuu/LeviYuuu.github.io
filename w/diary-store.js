/**
 * diary-store.js
 * 通过 GitHub REST API 将日记数据存储为仓库中的 JSON 文件。
 *
 * 依赖：一个 GitHub Personal Access Token（fine-grained，需要 Contents read/write 权限）。
 * Token 在用户执行写操作（写日记/删除）时按需输入，存入 sessionStorage，
 * 同一标签页内后续操作免重复验证，关闭标签页即失效。
 */
var DiaryStore = (function () {
    'use strict';

    var REPO_OWNER = 'LeviYuuu';
    var REPO_NAME = 'LeviYuuu.github.io';
    var FILE_PATH = 'w/diary-entries.json';
    var BRANCH = 'main';

    var TOKEN_KEY = 'diary_gh_token';
    var API_BASE = 'https://api.github.com';

    // ========== Token 管理 ==========
    function getToken() {
        return sessionStorage.getItem(TOKEN_KEY) || '';
    }

    function setToken(token) {
        sessionStorage.setItem(TOKEN_KEY, token);
    }

    function clearToken() {
        sessionStorage.removeItem(TOKEN_KEY);
    }

    function hasToken() {
        return !!getToken();
    }

    // ========== 通用请求 ==========
    function apiRequest(method, path, body) {
        var opts = {
            method: method,
            headers: {
                'Authorization': 'Bearer ' + getToken(),
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            }
        };
        if (body) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
        return fetch(API_BASE + path, opts).then(function (res) {
            if (res.status === 401 || res.status === 403) {
                clearToken();
                return Promise.reject(new Error('Token 无效或已过期，请重新输入'));
            }
            return res.json().then(function (data) {
                if (!res.ok) {
                    return Promise.reject(new Error(data.message || 'GitHub API 错误'));
                }
                return data;
            });
        });
    }

    // ========== 验证 Token 是否有效 ==========
    function validateToken(token) {
        return fetch(API_BASE + '/repos/' + REPO_OWNER + '/' + REPO_NAME, {
            headers: {
                'Authorization': 'Bearer ' + token,
                'Accept': 'application/vnd.github+json'
            }
        }).then(function (res) {
            if (res.ok) {
                setToken(token);
                return true;
            }
            return false;
        }).catch(function () {
            return false;
        });
    }

    // ========== 读取远程日记 ==========
    // 返回 { entries: [...], sha: "..." }
    // sha 用于后续更新时防止冲突
    var _cachedSha = null;

    function loadEntries() {
        var path = '/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents/' + FILE_PATH + '?ref=' + BRANCH;
        return apiRequest('GET', path).then(function (data) {
            _cachedSha = data.sha;
            // GitHub 返回的 content 是 base64 编码的
            var decoded = decodeBase64(data.content);
            try {
                return JSON.parse(decoded);
            } catch (e) {
                return [];
            }
        }).catch(function (err) {
            // 文件不存在时返回空数组
            if (err.message && err.message.indexOf('Not Found') !== -1) {
                _cachedSha = null;
                return [];
            }
            throw err;
        });
    }

    // ========== 保存远程日记 ==========
    function saveEntries(entries, commitMessage) {
        var content = encodeBase64(JSON.stringify(entries, null, 2));
        var body = {
            message: commitMessage || '更新日记 ' + new Date().toLocaleString('zh-CN'),
            content: content,
            branch: BRANCH
        };
        if (_cachedSha) {
            body.sha = _cachedSha;
        }

        var path = '/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents/' + FILE_PATH;
        return apiRequest('PUT', path, body).then(function (data) {
            _cachedSha = data.content.sha;
            return true;
        });
    }

    // ========== Base64 工具（支持中文） ==========
    function encodeBase64(str) {
        return btoa(unescape(encodeURIComponent(str)));
    }

    function decodeBase64(str) {
        // GitHub 返回的 base64 可能带换行，先去掉
        var cleaned = str.replace(/\s/g, '');
        return decodeURIComponent(escape(atob(cleaned)));
    }

    // ========== 公开接口 ==========
    return {
        getToken: getToken,
        setToken: setToken,
        clearToken: clearToken,
        hasToken: hasToken,
        validateToken: validateToken,
        loadEntries: loadEntries,
        saveEntries: saveEntries
    };
})();
