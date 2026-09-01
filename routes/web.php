<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\RfqController;
use App\Http\Controllers\QuotationController;

Route::get('/', [RfqController::class, 'index'])->name('rfq.index');
Route::post('/rfq/store', [RfqController::class, 'store'])->name('rfq.store');

Route::get('/quotation/create', [QuotationController::class, 'create'])->name('quotation.create');
Route::post('/quotation/send-email', [QuotationController::class, 'sendEmailOffer'])->name('quotation.send-email');
