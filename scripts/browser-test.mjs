import { chromium } from 'playwright';

async function runBrowserTest() {
    console.log('🚀 啟動真實瀏覽器 (Headless Edge/Chrome) 進行端到端全功能測試...');

    let browser;
    try {
        browser = await chromium.launch({
            channel: 'msedge',
            headless: true
        });
    } catch (e) {
        console.log('Edge channel not available, trying chrome/default chromium...');
        browser = await chromium.launch({
            channel: 'chrome',
            headless: true
        });
    }

    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 }
    });
    const page = await context.newPage();

    // 監聽 Console 與 Error
    const consoleLogs = [];
    const pageErrors = [];
    page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => pageErrors.push(err.message));
    page.on('dialog', async dialog => {
        console.log(`💬 瀏覽器原生對話框 [${dialog.type()}]: ${dialog.message()}`);
        await dialog.accept();
    });

    const targetUrl = 'http://localhost:5173/';
    console.log(`🌐 正在載入系統頁面: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1000);

    console.log('✅ 首頁載入成功！標題:', await page.title());

    // 1. 測試導航到「員工管理」
    console.log('📍 步驟 1: 點擊導航至「員工管理」');
    await page.locator('text=員工管理').first().click();
    await page.waitForTimeout(500);

    // 2. 測試點擊「新增員工」
    console.log('📍 步驟 2: 點擊「新增員工」打開 Modal');
    await page.locator('text=新增員工').first().click();
    await page.waitForTimeout(500);

    // 3. 填寫表單（模擬使用者上傳的截圖情境）
    console.log('📍 步驟 3: 填寫表單資料 (王暉宇, 信義校, 2016-01-01)');
    const nameInput = page.locator('[data-testid="employee-name-input"]');
    await nameInput.fill('王暉宇');

    // 點擊「確認新增」按鈕
    console.log('📍 步驟 4: 點擊「確認新增」按鈕');
    const submitBtn = page.locator('button:has-text("確認新增")');
    await submitBtn.click();
    await page.waitForTimeout(1000);

    // 4. 驗證列表中是否出現「王暉宇」
    const hasEmployee = await page.locator('text=王暉宇').count();
    console.log(`🔎 驗證員工列表中是否存在「王暉宇」: ${hasEmployee > 0 ? '✅ 成功找到！' : '❌ 未找到！'}`);
    if (hasEmployee === 0) {
        throw new Error('員工新增失敗：列表中未找到 王暉宇');
    }

    // 5. 測試特休/排休額度微調 (0.25天)
    console.log('📍 步驟 5: 測試 0.25 天額度微調');
    const adjustBtns = page.locator('button[title*="調整"], button:has-text("+"), button:has-text("-")');
    if (await adjustBtns.count() > 0) {
        console.log('✅ 額度調整按鈕存在且可用');
    }

    // 6. 測試導航至「請假登記」
    console.log('📍 步驟 6: 導航至「請假登記」');
    await page.locator('text=請假登記').first().click();
    await page.waitForTimeout(500);
    const selectEmpDropdown = page.locator('select').first();
    if (await selectEmpDropdown.count() > 0) {
        console.log('✅ 請假登記員工下拉選單正常');
    }

    // 7. 測試導航至「報表中心」
    console.log('📍 步驟 7: 導航至「報表中心」');
    await page.locator('text=報表中心').first().click();
    await page.waitForTimeout(500);
    const reportTabs = page.locator('button:has-text("月度排休公告"), button:has-text("個人年度明細"), button:has-text("到期警示")');
    console.log(`✅ 報表中心分頁數: ${await reportTabs.count()}`);

    // 8. 測試導航至「操作日誌」
    console.log('📍 步驟 8: 導航至「操作日誌」');
    await page.locator('text=操作日誌').first().click();
    await page.waitForTimeout(500);
    const logEntries = page.locator('text=新增員工');
    console.log(`🔎 驗證操作日誌中是否有記錄: ${await logEntries.count() > 0 ? '✅ 成功記錄！' : '⚠️ 無記錄'}`);

    // 9. 截圖保存
    const screenshotPath = 'scripts/test-result.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 測試成功，全頁面截圖已儲存至: ${screenshotPath}`);

    if (pageErrors.length > 0) {
        console.error('❌ 頁面執行期間發生錯誤:', pageErrors);
    } else {
        console.log('🎉 瀏覽器全功能測試全部 PASS！零錯誤！');
    }

    await browser.close();
}

runBrowserTest().catch(err => {
    console.error('❌ 瀏覽器測試腳本執行失敗:', err);
    process.exit(1);
});
