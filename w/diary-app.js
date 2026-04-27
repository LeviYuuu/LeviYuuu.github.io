(function () {
    'use strict';

    // ========== 状态 ==========
    var remoteEntries = [];     // 从 GitHub 加载的用户日记
    var isSaving = false;       // 防止重复保存
    var pendingAction = null;   // 密码验证通过后要执行的回调

    // ========== DOM 引用 ==========
    var overlay = document.getElementById('modalOverlay');
    var btnNew = document.getElementById('btnNewDiary');
    var btnClose = document.getElementById('modalClose');
    var btnCancel = document.getElementById('btnCancel');
    var btnSave = document.getElementById('btnSave');
    var inputTitle = document.getElementById('diaryTitle');
    var inputContent = document.getElementById('diaryContent');
    var diaryList = document.getElementById('diaryList');
    var syncStatus = document.getElementById('syncStatus');

    // 密码弹窗
    var pwOverlay = document.getElementById('passwordOverlay');
    var pwInput = document.getElementById('passwordInput');
    var pwHint = document.getElementById('passwordHint');
    var pwClose = document.getElementById('passwordClose');
    var pwCancel = document.getElementById('passwordCancel');
    var pwConfirm = document.getElementById('passwordConfirm');

    // ========== 工具函数 ==========
    function escapeHTML(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showSync(msg, isError) {
        if (!syncStatus) return;
        syncStatus.textContent = msg;
        syncStatus.className = 'sync-status' + (isError ? ' sync-error' : '');
        syncStatus.style.display = 'block';
        if (!isError) {
            setTimeout(function () {
                syncStatus.style.display = 'none';
            }, 3000);
        }
    }

    // ========== 密码验证流程 ==========
    // 如果 sessionStorage 里已有有效 token，直接执行；否则弹密码框
    function requireAuth(actionCallback) {
        if (DiaryStore.hasToken()) {
            actionCallback();
        } else {
            pendingAction = actionCallback;
            openPasswordModal();
        }
    }

    function openPasswordModal() {
        pwInput.value = '';
        pwHint.style.display = 'none';
        pwHint.textContent = '';
        pwOverlay.classList.add('active');
        pwInput.focus();
    }

    function closePasswordModal() {
        pwOverlay.classList.remove('active');
        pendingAction = null;
    }

    function doPasswordConfirm() {
        var token = pwInput.value.trim();
        if (!token) {
            pwHint.textContent = '请输入密码';
            pwHint.style.display = 'block';
            return;
        }

        pwHint.textContent = '验证中...';
        pwHint.style.display = 'block';
        pwConfirm.disabled = true;

        DiaryStore.validateToken(token).then(function (ok) {
            pwConfirm.disabled = false;
            if (ok) {
                // 先取出待执行的操作，再关弹窗（关弹窗会清空 pendingAction）
                var action = pendingAction;
                closePasswordModal();
                // 验证通过，加载远程数据后执行待定操作
                loadFromRemote().then(function () {
                    if (action) {
                        action();
                    }
                });
            } else {
                pwHint.textContent = '看看得了呗';
                pwHint.className = 'password-hint password-hint-reject';
            }
        });
    }

    // 密码弹窗事件
    pwClose.addEventListener('click', closePasswordModal);
    pwCancel.addEventListener('click', closePasswordModal);
    pwConfirm.addEventListener('click', doPasswordConfirm);
    pwInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') doPasswordConfirm();
    });
    pwOverlay.addEventListener('click', function (e) {
        if (e.target === pwOverlay) closePasswordModal();
    });

    // ========== 渲染单条日记（时间线节点） ==========
    function createEntryElement(entry, isUserEntry, index) {
        // 外层时间线节点
        var node = document.createElement('div');
        node.className = 'timeline-node';
        if (isUserEntry) {
            node.classList.add('entry-user');
        }

        // 内层日记卡片
        var article = document.createElement('article');
        article.className = 'entry';

        var inner = '';
        if (entry.title) {
            inner += '<h2>' + escapeHTML(entry.title) + '</h2>';
        }
        inner += '<p>' + entry.content + '</p>';

        // 用户日记始终显示删除按钮
        if (isUserEntry) {
            inner += '<button class="btn-delete" data-index="' + index + '" title="删除这篇日记">&times;</button>';
        }

        article.innerHTML = inner;
        node.appendChild(article);
        return node;
    }

    // ========== 渲染所有日记 ==========
    function renderAll() {
        diaryList.innerHTML = '';

        // 先渲染用户新增的（最新在最前）
        for (var i = 0; i < remoteEntries.length; i++) {
            diaryList.appendChild(createEntryElement(remoteEntries[i], true, i));
        }

        // 再渲染默认日记
        for (var j = 0; j < DEFAULT_ENTRIES.length; j++) {
            diaryList.appendChild(createEntryElement(DEFAULT_ENTRIES[j], false, j));
        }

        bindDeleteButtons();
    }

    // ========== 删除日记 ==========
    function bindDeleteButtons() {
        var buttons = document.querySelectorAll('.btn-delete');
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].addEventListener('click', function () {
                var idx = parseInt(this.getAttribute('data-index'), 10);
                requireAuth(function () {
                    if (confirm('确定要删除这篇日记吗？')) {
                        remoteEntries.splice(idx, 1);
                        renderAll();
                        saveToRemote('删除日记');
                    }
                });
            });
        }
    }

    // ========== 远程存储操作 ==========
    function loadFromRemote() {
        showSync('正在同步...');
        return DiaryStore.loadEntries().then(function (entries) {
            remoteEntries = entries || [];
            renderAll();
            showSync('已同步');
        }).catch(function (err) {
            showSync('同步失败: ' + err.message, true);
        });
    }

    function saveToRemote(action) {
        if (isSaving) return;
        isSaving = true;
        showSync('正在保存...');
        DiaryStore.saveEntries(remoteEntries, action).then(function () {
            showSync('已保存');
            isSaving = false;
        }).catch(function (err) {
            showSync('保存失败: ' + err.message, true);
            isSaving = false;
        });
    }

    // ========== 写日记弹窗控制 ==========
    function openModal() {
        overlay.classList.add('active');
        inputTitle.value = '';
        inputContent.value = '';
        inputTitle.focus();
    }

    function closeModal() {
        overlay.classList.remove('active');
    }

    // 点击"写日记"按钮：先验证密码，再打开弹窗
    btnNew.addEventListener('click', function () {
        requireAuth(function () {
            openModal();
        });
    });

    btnClose.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);

    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeModal();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            if (overlay.classList.contains('active')) closeModal();
            if (pwOverlay.classList.contains('active')) closePasswordModal();
        }
    });

    // ========== 保存日记 ==========
    btnSave.addEventListener('click', function () {
        var title = inputTitle.value.trim();
        var content = inputContent.value.trim();

        if (!content) {
            alert('日记内容不能为空');
            return;
        }

        var htmlContent = escapeHTML(content).replace(/\n/g, '<br>');

        var newEntry = {
            title: title,
            content: htmlContent,
            createdAt: new Date().toISOString()
        };

        remoteEntries.unshift(newEntry);
        closeModal();
        renderAll();
        saveToRemote('新增日记: ' + (title || '无标题'));
    });

    // ========== 初始化 ==========
    // 公开仓库无需 token 也能读取，始终加载远程日记
    loadFromRemote();
})();
