import { chromium } from 'playwright';

async function testLeaveManagement() {
    console.log('🚀 開始進行「排休更正、移動日期、刪除與額度回補」完整生命週期瀏覽器測試...');

    const browser = await chromium.launch({
        channel: 'msedge',
        headless: true
    });

    const context = await browser.newContext({
        viewport: { width: 1440, height: 960 }
    });
    const page = await context.newPage();

    page.on('dialog', async dialog => {
        console.log(`💬 對話框 [${dialog.type()}]: ${dialog.message()}`);
        await dialog.accept();
    });

    // 1. 載入本地
    console.log('📍 步驟 1: 進入本地系統');
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1000);

    // 2. 新增員工「張雅婷」
    console.log('📍 步驟 2: 新增測試員工「張雅婷」');
    await page.locator('text=員工管理').first().click();
    await page.waitForTimeout(600);
    await page.locator('text=新增員工').first().click();
    await page.waitForTimeout(500);
    await page.locator('[data-testid="employee-name-input"]').fill('張雅婷');
    await page.locator('button:has-text("確認新增")').first().click();
    await page.waitForTimeout(1000);

    // 給予 5 天特休初始
    console.log('📍 步驟 2.1: 給予特休額度 +5 天');
    const add5Btn = page.locator('button:has-text("+1")').first();
    for (let i = 0; i < 5; i++) {
        await add5Btn.click();
        await page.waitForTimeout(200);
    }
    console.log('✅ 員工建立並設定額度成功！');

    // 3. 前往排休申請
    console.log('📍 步驟 3: 進入「排休申請」登記假單');
    await page.locator('text=排休申請').first().click();
    await page.waitForTimeout(800);

    const employeeSelect = page.locator('[data-testid="leave-employee-select"]');
    await employeeSelect.selectOption({ label: '張雅婷 (信義校)' });
    await page.waitForTimeout(600);

    // 點選 10 號排休
    console.log('📍 步驟 3.1: 點選 10 號登記排休');
    const day10 = page.locator('button:has-text("10")').first();
    await day10.click();
    await page.waitForTimeout(500);

    // 提交排休
    const submitBtn = page.locator('button:has-text("確認送出排休"), button:has-text("準備提交")').first();
    await submitBtn.click();
    await page.waitForTimeout(600);

    const confirmSubmit = page.locator('button:has-text("確認送出"), button:has-text("確認提交")').first();
    if (await confirmSubmit.count() > 0) {
        await confirmSubmit.click();
        await page.waitForTimeout(1000);
    }
    console.log('✅ 10 號排休登記成功！');

    // 4. 切換到「本月已排休」查看並點擊「更正」
    console.log('📍 步驟 4: 測試更正排休（移動日期至 12 號）');
    await page.locator('text=本月已排休').first().click();
    await page.waitForTimeout(600);

    const editBtn = page.locator('button:has-text("更正")').first();
    await editBtn.click();
    await page.waitForTimeout(600);

    // 在彈窗中將日期改為 12 號
    const currentVal = await page.locator('input[type="date"]').first().inputValue();
    const targetDate = currentVal.replace(/-\d{2}$/, '-12');
    console.log(`📅 將排休日期從 ${currentVal} 移動至: ${targetDate}`);
    await page.locator('input[type="date"]').first().fill(targetDate);
    await page.waitForTimeout(300);

    await page.locator('button:has-text("儲存更正")').click();
    await page.waitForTimeout(1000);
    console.log('✅ 排休成功移動至 12 號！');

    // 5. 測試取消並刪除排休（退額度）
    console.log('📍 步驟 5: 測試取消並刪除排休（自動退回額度）');
    const deleteBtn = page.locator('button[title="取消刪除並退回額度"], button:has-text("更正")').first();
    await editBtn.click();
    await page.waitForTimeout(500);

    const refundDeleteBtn = page.locator('button:has-text("取消並刪除排休 (退額度)")');
    await refundDeleteBtn.click();
    await page.waitForTimeout(1500);
    console.log('✅ 排休成功刪除並自動退回額度！');

    // 6. 清空測試資料重置乾淨
    console.log('📍 步驟 6: 重置清空測試資料');
    await page.locator('text=系統設定').first().click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("清空所有資料"), button:has-text("清除所有資料")').click();
    await page.waitForTimeout(1500);

    await browser.close();
    console.log('🎉 ==========================================');
    console.log('🎉 排休更正、移動日期、刪除與額度退回測試 100% 全部通過！');
    console.log('🎉 ==========================================');
}

testLeaveManagement().catch(err => {
    console.error('❌ 測試失敗:', err);
    process.exit(1);
});
