<?php

declare(strict_types=1);

namespace Worknest\Api\Presentation\Responses;

use PDOException;
use Throwable;
use Worknest\Api\Application\Exceptions\ApiException;
use Worknest\Api\Application\Http\Response;

final class ApiExceptionHandler
{
    public function handleApiException(ApiException $exception): Response
    {
        return Response::error(
            $exception->errorCode(),
            $exception->getMessage(),
            $exception->statusCode(),
            $exception->details()
        );
    }

    public function handleThrowable(Throwable $exception): Response
    {
        if ($exception instanceof PDOException) {
            return Response::error('DATABASE_ERROR', 'The API database operation failed.', 500, [
                'message' => $exception->getMessage(),
            ]);
        }

        return Response::error('SERVER_ERROR', 'Unexpected API failure.', 500, [
            'message' => $exception->getMessage(),
        ]);
    }
}
