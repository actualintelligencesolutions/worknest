<?php

declare(strict_types=1);

namespace Worknest\Api\Bootstrap;

use Worknest\Api\Application\Middleware\MiddlewarePipeline;
use Worknest\Api\Application\Routing\Router;
use Worknest\Api\Application\Support\App;
use Worknest\Api\Application\Support\Container;
use Worknest\Api\Domain\Audit\AuditLogger;
use Worknest\Api\Domain\Auth\AuthService;
use Worknest\Api\Domain\Auth\OtpService;
use Worknest\Api\Domain\Auth\SessionService;
use Worknest\Api\Domain\Office\OfficeService;
use Worknest\Api\Domain\Payslip\PayslipPdfGenerator;
use Worknest\Api\Domain\Payslip\PayslipService;
use Worknest\Api\Domain\Payroll\PayrollService;
use Worknest\Api\Domain\Tenant\TenantResolver;
use Worknest\Api\Domain\Tenant\TenantService;
use Worknest\Api\Domain\User\UserService;
use Worknest\Api\Infrastructure\Database\DatabaseConnection;
use Worknest\Api\Infrastructure\Database\TransactionManager;
use Worknest\Api\Infrastructure\Notifications\Mailer;
use Worknest\Api\Infrastructure\Repositories\AuditLogRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\OfficeRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\OtpChallengeRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\PayrollBatchRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\PayrollRecordRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\PayslipRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\PdoAuditLogRepository;
use Worknest\Api\Infrastructure\Repositories\PdoOfficeRepository;
use Worknest\Api\Infrastructure\Repositories\PdoOtpChallengeRepository;
use Worknest\Api\Infrastructure\Repositories\PdoPayrollBatchRepository;
use Worknest\Api\Infrastructure\Repositories\PdoPayrollRecordRepository;
use Worknest\Api\Infrastructure\Repositories\PdoPayslipRepository;
use Worknest\Api\Infrastructure\Repositories\PdoPlanRepository;
use Worknest\Api\Infrastructure\Repositories\PdoRoleRepository;
use Worknest\Api\Infrastructure\Repositories\PdoSessionRepository;
use Worknest\Api\Infrastructure\Repositories\PdoSiteOwnerInviteRepository;
use Worknest\Api\Infrastructure\Repositories\PdoTenantRepository;
use Worknest\Api\Infrastructure\Repositories\PdoUserRepository;
use Worknest\Api\Infrastructure\Repositories\PlanRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\RoleRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\SessionRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\SiteOwnerInviteRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\TenantRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\UserRepositoryInterface;
use Worknest\Api\Infrastructure\Security\PasswordHasher;
use Worknest\Api\Infrastructure\Security\PinHasher;
use Worknest\Api\Infrastructure\Storage\CsvParser;
use Worknest\Api\Infrastructure\Storage\ExcelImportAdapter;
use Worknest\Api\Infrastructure\Storage\FileStorageService;
use Worknest\Api\Infrastructure\Storage\NullExcelImportAdapter;
use Worknest\Api\Presentation\Controllers\AuthController;
use Worknest\Api\Presentation\Controllers\OfficeController;
use Worknest\Api\Presentation\Controllers\PayslipController;
use Worknest\Api\Presentation\Controllers\PayrollController;
use Worknest\Api\Presentation\Controllers\SystemController;
use Worknest\Api\Presentation\Controllers\TenantController;
use Worknest\Api\Presentation\Controllers\UserController;
use Worknest\Api\Presentation\Responses\ApiExceptionHandler;

function build_app(array $config): App
{
    $container = new Container();

    $container->singleton('config', fn ($c) => $config);
    $container->singleton(DatabaseConnection::class, fn ($c) => new DatabaseConnection($c->get('config')));
    $container->singleton(TransactionManager::class, fn ($c) => new TransactionManager($c->get(DatabaseConnection::class)));
    $container->singleton(PlanRepositoryInterface::class, fn ($c) => new PdoPlanRepository($c->get(DatabaseConnection::class)));
    $container->singleton(TenantRepositoryInterface::class, fn ($c) => new PdoTenantRepository($c->get(DatabaseConnection::class)));
    $container->singleton(OfficeRepositoryInterface::class, fn ($c) => new PdoOfficeRepository($c->get(DatabaseConnection::class)));
    $container->singleton(RoleRepositoryInterface::class, fn ($c) => new PdoRoleRepository($c->get(DatabaseConnection::class)));
    $container->singleton(UserRepositoryInterface::class, fn ($c) => new PdoUserRepository($c->get(DatabaseConnection::class)));
    $container->singleton(SessionRepositoryInterface::class, fn ($c) => new PdoSessionRepository($c->get(DatabaseConnection::class)));
    $container->singleton(OtpChallengeRepositoryInterface::class, fn ($c) => new PdoOtpChallengeRepository($c->get(DatabaseConnection::class)));
    $container->singleton(PayrollBatchRepositoryInterface::class, fn ($c) => new PdoPayrollBatchRepository($c->get(DatabaseConnection::class)));
    $container->singleton(PayrollRecordRepositoryInterface::class, fn ($c) => new PdoPayrollRecordRepository($c->get(DatabaseConnection::class)));
    $container->singleton(PayslipRepositoryInterface::class, fn ($c) => new PdoPayslipRepository($c->get(DatabaseConnection::class)));
    $container->singleton(SiteOwnerInviteRepositoryInterface::class, fn ($c) => new PdoSiteOwnerInviteRepository($c->get(DatabaseConnection::class)));
    $container->singleton(AuditLogRepositoryInterface::class, fn ($c) => new PdoAuditLogRepository($c->get(DatabaseConnection::class)));
    $container->singleton(PasswordHasher::class, fn ($c) => new PasswordHasher());
    $container->singleton(PinHasher::class, fn ($c) => new PinHasher());
    $container->singleton(Mailer::class, fn ($c) => new Mailer());
    $container->singleton(TenantResolver::class, fn ($c) => new TenantResolver());
    $container->singleton(CsvParser::class, fn ($c) => new CsvParser());
    $container->singleton(ExcelImportAdapter::class, fn ($c) => new NullExcelImportAdapter());
    $container->singleton(FileStorageService::class, fn ($c) => new FileStorageService(dirname(__DIR__, 2) . '/storage'));
    $container->singleton(AuditLogger::class, fn ($c) => new AuditLogger($c->get(AuditLogRepositoryInterface::class)));
    $container->singleton(PayslipPdfGenerator::class, fn ($c) => new PayslipPdfGenerator());
    $container->singleton(SessionService::class, fn ($c) => new SessionService(
        $c->get(SessionRepositoryInterface::class),
        $c->get(UserRepositoryInterface::class)
    ));
    $container->singleton(OtpService::class, fn ($c) => new OtpService(
        $c->get(OtpChallengeRepositoryInterface::class),
        $c->get(Mailer::class)
    ));
    $container->singleton(AuthService::class, fn ($c) => new AuthService(
        $c->get(TenantRepositoryInterface::class),
        $c->get(OfficeRepositoryInterface::class),
        $c->get(UserRepositoryInterface::class),
        $c->get(RoleRepositoryInterface::class),
        $c->get(PasswordHasher::class),
        $c->get(PinHasher::class),
        $c->get(OtpService::class),
        $c->get(SessionService::class),
        $c->get(TransactionManager::class),
        $c->get(AuditLogger::class)
    ));
    $container->singleton(OfficeService::class, fn ($c) => new OfficeService(
        $c->get(OfficeRepositoryInterface::class),
        $c->get(PlanRepositoryInterface::class),
        $c->get(UserRepositoryInterface::class),
        $c->get(PayrollBatchRepositoryInterface::class),
        $c->get(SiteOwnerInviteRepositoryInterface::class),
        $c->get(TenantRepositoryInterface::class),
        $c->get(RoleRepositoryInterface::class),
        $c->get(PasswordHasher::class),
        $c->get(Mailer::class),
        $c->get(SessionService::class),
        $c->get(TransactionManager::class),
        $c->get(AuditLogger::class),
        $c->get('config')
    ));
    $container->singleton(TenantService::class, fn ($c) => new TenantService(
        $c->get(TenantRepositoryInterface::class),
        $c->get(AuditLogger::class)
    ));
    $container->singleton(UserService::class, fn ($c) => new UserService(
        $c->get(UserRepositoryInterface::class),
        $c->get(OfficeRepositoryInterface::class),
        $c->get(RoleRepositoryInterface::class),
        $c->get(PasswordHasher::class),
        $c->get(PinHasher::class),
        $c->get(TransactionManager::class),
        $c->get(AuditLogger::class)
    ));
    $container->singleton(PayrollService::class, fn ($c) => new PayrollService(
        $c->get(PayrollBatchRepositoryInterface::class),
        $c->get(PayrollRecordRepositoryInterface::class),
        $c->get(PayslipRepositoryInterface::class),
        $c->get(UserRepositoryInterface::class),
        $c->get(OfficeRepositoryInterface::class),
        $c->get(RoleRepositoryInterface::class),
        $c->get(PinHasher::class),
        $c->get(FileStorageService::class),
        $c->get(CsvParser::class),
        $c->get(ExcelImportAdapter::class),
        $c->get(TransactionManager::class),
        $c->get(AuditLogger::class),
        $c->get(PayslipPdfGenerator::class)
    ));
    $container->singleton(PayslipService::class, fn ($c) => new PayslipService(
        $c->get(PayslipRepositoryInterface::class),
        $c->get(OfficeRepositoryInterface::class),
        $c->get(PayslipPdfGenerator::class),
        $c->get(AuditLogger::class),
    ));
    $container->singleton(ApiExceptionHandler::class, fn ($c) => new ApiExceptionHandler());
    $container->singleton(SystemController::class, fn ($c) => new SystemController(
        $c->get('config'),
        $c->get(PlanRepositoryInterface::class)
    ));
    $container->singleton(AuthController::class, fn ($c) => new AuthController(
        $c->get(AuthService::class),
        $c->get(TenantResolver::class)
    ));
    $container->singleton(TenantController::class, fn ($c) => new TenantController(
        $c->get(AuthService::class),
        $c->get(OtpService::class),
        $c->get(TenantResolver::class),
        $c->get(TenantService::class),
        $c->get(OfficeService::class)
    ));
    $container->singleton(OfficeController::class, fn ($c) => new OfficeController(
        $c->get(AuthService::class),
        $c->get(TenantResolver::class),
        $c->get(OfficeService::class)
    ));
    $container->singleton(UserController::class, fn ($c) => new UserController(
        $c->get(AuthService::class),
        $c->get(TenantResolver::class),
        $c->get(UserService::class)
    ));
    $container->singleton(PayrollController::class, fn ($c) => new PayrollController(
        $c->get(AuthService::class),
        $c->get(TenantResolver::class),
        $c->get(PayrollService::class)
    ));
    $container->singleton(PayslipController::class, fn ($c) => new PayslipController(
        $c->get(AuthService::class),
        $c->get(TenantResolver::class),
        $c->get(PayslipService::class)
    ));

    $router = new Router();
    register_routes($router, $container);

    return new App($router, new MiddlewarePipeline(), $container->get(ApiExceptionHandler::class));
}

function register_routes(Router $router, Container $container): void
{
    $router->add('GET', '/health', fn ($request) => $container->get(SystemController::class)->health($request));
    $router->add('GET', '/endpoints', fn ($request) => $container->get(SystemController::class)->endpoints($request));
    $router->add('GET', '/plans', fn ($request) => $container->get(SystemController::class)->plans($request));

    $router->add('POST', '/companies/register', fn ($request) => $container->get(AuthController::class)->registerCompany($request));
    $router->add('GET', '/companies/check-workspace', fn ($request) => $container->get(AuthController::class)->checkWorkspace($request));
    $router->add('POST', '/auth/admin/verify-otp', fn ($request) => $container->get(AuthController::class)->verifyAdminOtp($request));
    $router->add('POST', '/auth/admin/login', fn ($request) => $container->get(AuthController::class)->adminLogin($request));
    $router->add('POST', '/auth/owner-login', fn ($request) => $container->get(AuthController::class)->ownerLogin($request));
    $router->add('POST', '/auth/branch-login', fn ($request) => $container->get(AuthController::class)->branchLogin($request));
    $router->add('POST', '/auth/hr-login', fn ($request) => $container->get(AuthController::class)->hrLogin($request));
    $router->add('POST', '/auth/employee-login', fn ($request) => $container->get(AuthController::class)->employeeLogin($request));
    $router->add('POST', '/auth/logout', fn ($request) => $container->get(AuthController::class)->logout($request));
    $router->add('GET', '/auth/me', fn ($request) => $container->get(AuthController::class)->me($request));

    $router->add('GET', '/offices', fn ($request) => $container->get(OfficeController::class)->list($request));
    $router->add('GET', '/locations', fn ($request) => $container->get(OfficeController::class)->list($request));
    $router->add('GET', '/site', fn ($request) => $container->get(OfficeController::class)->sitePortal($request));
    $router->add('GET', '/offices/{id}', fn ($request) => $container->get(OfficeController::class)->detail($request));
    $router->add('GET', '/branches/{id}', fn ($request) => $container->get(OfficeController::class)->detail($request));
    $router->add('POST', '/main-office', fn ($request) => $container->get(OfficeController::class)->createMainOffice($request));
    $router->add('POST', '/branches', fn ($request) => $container->get(OfficeController::class)->createBranch($request));
    $router->add('PATCH', '/offices/{id}', fn ($request) => $container->get(OfficeController::class)->update($request));
    $router->add('POST', '/offices/{id}/plans', fn ($request) => $container->get(OfficeController::class)->assignPlan($request));
    $router->add('POST', '/offices/{id}/admins', fn ($request) => $container->get(OfficeController::class)->assignAdmins($request));
    $router->add('POST', '/offices/{id}/site-owner-invites', fn ($request) => $container->get(OfficeController::class)->inviteSiteOwner($request));
    $router->add('POST', '/offices/{id}/site-owner-invites/{inviteId}/resend', fn ($request) => $container->get(OfficeController::class)->resendSiteOwnerInvite($request));
    $router->add('POST', '/offices/{id}/site-owner-invites/{inviteId}/cancel', fn ($request) => $container->get(OfficeController::class)->cancelSiteOwnerInvite($request));

    $router->add('POST', '/users', fn ($request) => $container->get(UserController::class)->create($request));
    $router->add('GET', '/users', fn ($request) => $container->get(UserController::class)->list($request));
    $router->add('GET', '/users/{id}', fn ($request) => $container->get(UserController::class)->detail($request));
    $router->add('PATCH', '/users/{id}', fn ($request) => $container->get(UserController::class)->update($request));
    $router->add('POST', '/users/{id}/reset-pin', fn ($request) => $container->get(UserController::class)->resetPin($request));
    $router->add('POST', '/offices/{id}/employee-pins/reset', fn ($request) => $container->get(UserController::class)->resetPinsForOffice($request));
    $router->add('GET', '/employees', fn ($request) => $container->get(UserController::class)->list($request));

    $router->add('POST', '/payroll-batches', fn ($request) => $container->get(PayrollController::class)->upload($request));
    $router->add('GET', '/payroll-batches', fn ($request) => $container->get(PayrollController::class)->list($request));
    $router->add('GET', '/payroll-batches/{id}', fn ($request) => $container->get(PayrollController::class)->detail($request));
    $router->add('POST', '/payroll-batches/{id}/mapping', fn ($request) => $container->get(PayrollController::class)->mapping($request));
    $router->add('POST', '/payroll-batches/{id}/validate', fn ($request) => $container->get(PayrollController::class)->validate($request));
    $router->add('POST', '/payroll-batches/{id}/import-missing-employees', fn ($request) => $container->get(PayrollController::class)->importMissingEmployees($request));
    $router->add('POST', '/payroll-batches/{id}/confirm', fn ($request) => $container->get(PayrollController::class)->confirm($request));
    $router->add('POST', '/payroll-batches/{id}/publish', fn ($request) => $container->get(PayrollController::class)->publish($request));

    $router->add('GET', '/payslips', fn ($request) => $container->get(PayslipController::class)->list($request));
    $router->add('GET', '/payslips/{id}', fn ($request) => $container->get(PayslipController::class)->detail($request));
    $router->add('GET', '/payslips/{id}/download', fn ($request) => $container->get(PayslipController::class)->download($request));

    $router->add('POST', '/v2/tenants', fn ($request) => $container->get(TenantController::class)->create($request));
    $router->add('GET', '/v2/tenants/check-slug', fn ($request) => $container->get(TenantController::class)->checkSlug($request));
    $router->add('GET', '/v2/tenants/{tenantId}', fn ($request) => $container->get(TenantController::class)->detail($request));
    $router->add('PATCH', '/v2/tenants/{tenantId}', fn ($request) => $container->get(TenantController::class)->update($request));
    $router->add('POST', '/v2/tenants/{tenantId}/main-office', fn ($request) => $container->get(TenantController::class)->createMainOffice($request));

    $router->add('POST', '/v2/auth/admin/login', fn ($request) => $container->get(AuthController::class)->adminLogin($request));
    $router->add('POST', '/v2/auth/employee/login', fn ($request) => $container->get(AuthController::class)->employeeLogin($request));
    $router->add('POST', '/v2/auth/logout', fn ($request) => $container->get(AuthController::class)->logout($request));
    $router->add('GET', '/v2/auth/me', fn ($request) => $container->get(AuthController::class)->me($request));
    $router->add('POST', '/v2/auth/otp/challenges', fn ($request) => $container->get(TenantController::class)->createOtpChallenge($request));
    $router->add('POST', '/v2/auth/otp/verify', fn ($request) => $container->get(AuthController::class)->verifyAdminOtp($request));

    $router->add('GET', '/v2/offices', fn ($request) => $container->get(OfficeController::class)->list($request));
    $router->add('GET', '/v2/site', fn ($request) => $container->get(OfficeController::class)->sitePortal($request));
    $router->add('POST', '/v2/offices', fn ($request) => $container->get(OfficeController::class)->create($request));
    $router->add('GET', '/v2/offices/{id}', fn ($request) => $container->get(OfficeController::class)->detail($request));
    $router->add('PATCH', '/v2/offices/{id}', fn ($request) => $container->get(OfficeController::class)->update($request));
    $router->add('POST', '/v2/offices/{id}/plan-assignments', fn ($request) => $container->get(OfficeController::class)->assignPlan($request));
    $router->add('GET', '/v2/offices/{id}/plan-assignments', fn ($request) => $container->get(OfficeController::class)->listPlans($request));
    $router->add('POST', '/v2/offices/{id}/admins', fn ($request) => $container->get(OfficeController::class)->assignAdmins($request));
    $router->add('POST', '/v2/offices/{id}/site-owner-invites', fn ($request) => $container->get(OfficeController::class)->inviteSiteOwner($request));
    $router->add('POST', '/v2/offices/{id}/site-owner-invites/{inviteId}/resend', fn ($request) => $container->get(OfficeController::class)->resendSiteOwnerInvite($request));
    $router->add('POST', '/v2/offices/{id}/site-owner-invites/{inviteId}/cancel', fn ($request) => $container->get(OfficeController::class)->cancelSiteOwnerInvite($request));
    $router->add('GET', '/v2/site-owner-invites/accept', fn ($request) => $container->get(OfficeController::class)->inviteAcceptanceDetail($request));
    $router->add('POST', '/v2/site-owner-invites/accept', fn ($request) => $container->get(OfficeController::class)->acceptSiteOwnerInvite($request));

    $router->add('GET', '/v2/users', fn ($request) => $container->get(UserController::class)->list($request));
    $router->add('POST', '/v2/users', fn ($request) => $container->get(UserController::class)->create($request));
    $router->add('GET', '/v2/users/{id}', fn ($request) => $container->get(UserController::class)->detail($request));
    $router->add('PATCH', '/v2/users/{id}', fn ($request) => $container->get(UserController::class)->update($request));
    $router->add('POST', '/v2/users/{id}/pin/reset', fn ($request) => $container->get(UserController::class)->resetPin($request));
    $router->add('POST', '/v2/offices/{id}/employee-pins/reset', fn ($request) => $container->get(UserController::class)->resetPinsForOffice($request));

    $router->add('POST', '/v2/payroll/batches', fn ($request) => $container->get(PayrollController::class)->upload($request));
    $router->add('GET', '/v2/payroll/batches', fn ($request) => $container->get(PayrollController::class)->list($request));
    $router->add('GET', '/v2/payroll/batches/{id}', fn ($request) => $container->get(PayrollController::class)->detail($request));
    $router->add('POST', '/v2/payroll/batches/{id}/mapping', fn ($request) => $container->get(PayrollController::class)->mapping($request));
    $router->add('POST', '/v2/payroll/batches/{id}/validate', fn ($request) => $container->get(PayrollController::class)->validate($request));
    $router->add('POST', '/v2/payroll/batches/{id}/import-missing-employees', fn ($request) => $container->get(PayrollController::class)->importMissingEmployees($request));
    $router->add('POST', '/v2/payroll/batches/{id}/confirm', fn ($request) => $container->get(PayrollController::class)->confirm($request));
    $router->add('POST', '/v2/payroll/batches/{id}/publish', fn ($request) => $container->get(PayrollController::class)->publish($request));

    $router->add('GET', '/v2/payslips', fn ($request) => $container->get(PayslipController::class)->list($request));
    $router->add('GET', '/v2/payslips/{id}', fn ($request) => $container->get(PayslipController::class)->detail($request));
    $router->add('GET', '/v2/payslips/{id}/download', fn ($request) => $container->get(PayslipController::class)->download($request));
}
