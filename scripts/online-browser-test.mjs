import { chromium } from 'playwright';

async function runOnlineBrowserTest() {
    console.log('🚀 啟動真實瀏覽器測試線上正式網址: https://feiye0306.github.io/leave-management-system/');

    const browser = await chromium.launch({
        channel: 'msedge',
        headless: true
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 }
    });
    const page = await context.newPage();

    page.on('dialog', async dialog => {
        console.log(`💬 線上對話框 [${dialog.type()}]: ${dialog.message()}`);
        await dialog.accept();
    });

    const targetUrl = 'https://feiye0306.github.io/leave-management-system/';
    console.log(`🌐 正在載入線上正式網站: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    console.log('✅ 線上網站載入成功！標題:', await page.title());

    // 1. 導航至員工管理
    console.log('📍 步驟 1: 點擊「員工管理」');
    await page.locator('text=員工管理').first().click();
    await page.waitForTimeout(600);

    // 2. 打開新增員工 Modal
    console.log('📍 步驟 2: 打開「新增員工」');
    await page.locator('text=新增員工').first().click();
    await page.waitForTimeout(600);

    // 3. 填寫表單
    console.log('📍 步驟 3: 填寫姓名「王暉宇」');
    const nameInput = page.locator('[data-testid="employee-name-input"], input[placeholder="請輸入員工姓名"]').first();
    await nameInput.fill('王暉宇');

    // 4. 點擊確認新增
    console.log('📍 步驟 4: 點擊「確認新增」');
    const submitBtn = page.locator('button:has-text("確認新增")');
    await submitBtn.click();
    await page.waitForTimeout(1000);

    // 5. 驗證王暉宇是否成功列出
    const hasEmployee = await page.locator('text=王暉宇').count();
    console.log(`🔎 驗證線上頁面中「王暉宇」: ${hasEmployee > 0 ? '✅ 成功找到！' : '❌ 未找到！'}`);

    // 6. 導航至排休申請
    console.log('📍 步驟 5: 導航至「排休申請」');
    await page.locator('text=排休申請').first().click();
    await page.waitForTimeout(600);

    // 7. 導航至報表中心
    console.log('📍 步驟 6: 導航至「報表中心」');
    await page.locator('text=報表中心').first().click();
    await page.waitForTimeout(600);

    // 8. 導航至操作日誌
    console.log('📍 步驟 7: 導航至「操作日誌」');
    await page.locator('text=操作日誌').first().click();
    await page.waitForTimeout(600);

    // 9. 截圖
    const screenshotPath = 'scripts/online-test-result.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 線上測試截圖已儲存至: ${screenshotPath}`);

    await browser.close();
    console.log('🎉 線上正式網址真實瀏覽器測試 PASS！');
}

runOnlineBrowserTest().catch(err => {
    console.error('❌ 線上測試失敗:', err);
    process.exit(1);
});
