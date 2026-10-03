<?php

namespace App\Contracts;

interface IpoProviderInterface
{
    /**
     * Get the unique identifier/name for this provider.
     */
    public function getName(): string;

    /**
     * Fetch list of IPOs normalized to a standard array format.
     *
     * @return array<int, array<string, mixed>>
     */
    public function fetchIpos(): array;
}
